/**
 * enter-runtime — L0 执行层
 *
 * MVP 主流程：
 * 1. 接收用户请求
 * 2. 加载所有 Artifact Headers → 注入 system prompt
 * 3. LLM 自己判断用哪个 Artifact 或升级
 * 4. 根据决策执行
 *    - execute → 加载 Artifact，返回结果
 *    - escalate → 调用 L1 CraftEngine → 拿到 craft report → 恢复会话继续
 * 5. 恢复会话时：L0 先参考 L1 返回信息，不够清楚时再自行决定是否读 Artifact
 * 6. 写入 RunRecord
 *
 * 会话管理：
 * - 通过 SessionRecorder 记录每轮对话（即时 append JSONL）
 * - L0 resume 时从 recorder 获取完整会话历史
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Artifact, Upgrade, RunRecord, TuiEvent } from "@ethan-computer/protocol-types";
import type { ArtifactRegistry, ArtifactSummary } from "@ethan-computer/artifact-registry";
import type { PiKernel } from "@ethan-computer/pi-kernel";
import type { CraftEngine, CraftOutput } from "@ethan-computer/craft-engine";
import {
  createSessionRecorder,
  type SessionRecorder,
} from "@ethan-computer/session-store";

// ── System Prompt 构造 ──────────────────────────────────

function buildL0SystemPrompt(summaries: ArtifactSummary[]): string {
  let prompt = `你是 Ethan Computer 的 L0 执行层。你的职责是基于已有的 Artifact 执行用户请求。

## 当前可用的 Artifact

`;

  if (summaries.length === 0) {
    prompt += `（暂无可用 Artifact）\n`;
  } else {
    summaries.forEach((s, i) => {
      prompt += `### ${i + 1}. ${s.header.title}\n`;
      prompt += `- artifact_id: ${s.artifact_id}\n`;
      prompt += `- when_to_use: ${s.header.when_to_use.join("、")}\n`;
      prompt += `- escalate_when: ${s.header.escalate_when.join("、")}\n`;
      prompt += `\n`;
    });
  }

  prompt += `## 你的决策规则

请根据用户请求和以上 Artifact 判断：

1. 如果某个 Artifact 的 when_to_use 匹配当前请求 → 选择它执行
2. 如果没有匹配的 Artifact，或请求触发了 escalate_when 条件 → 升级

## 输出格式

你必须输出合法 JSON（不要加 markdown 代码块标记）：

选择执行：
{"action":"execute","artifact_id":"<选中的artifact_id>","execution_plan":"<简要执行计划>"}

需要升级：
{"action":"escalate","reason":"<为什么当前Artifact不够>"}

`;

  return prompt;
}

// ── LLM 决策解析 ──────────────────────────────────────

interface ExecuteDecision {
  action: "execute";
  artifact_id: string;
  execution_plan: string;
}

interface EscalateDecision {
  action: "escalate";
  reason: string;
}

type L0Decision = ExecuteDecision | EscalateDecision;

function parseDecision(llmOutput: string): L0Decision {
  const cleaned = llmOutput
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { action: "escalate", reason: "无法解析 LLM 输出为决策" };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.action === "execute" && parsed.artifact_id) {
      return parsed as ExecuteDecision;
    }
    if (parsed.action === "escalate") {
      return parsed as EscalateDecision;
    }
    return { action: "escalate", reason: "LLM 输出格式不正确" };
  } catch {
    return { action: "escalate", reason: "LLM 输出 JSON 解析失败" };
  }
}

// ── RunRecord 写入 ─────────────────────────────────────

let runCounter = 0;

function generateRunId(): string {
  runCounter++;
  return `run_${String(runCounter).padStart(4, "0")}`;
}

async function writeRunRecord(runsDir: string, record: RunRecord): Promise<void> {
  const logsDir = join(runsDir, "logs");
  await mkdir(logsDir, { recursive: true });
  await writeFile(join(logsDir, `${record.run_id}.yaml`), yaml.dump(record, { lineWidth: -1 }), "utf-8");
}

// ── 结果类型 ────────────────────────────────────────────

/** L1 Craft 执行信息 */
export interface EnterCraftInfo {
  report: string;
  artifact_path: string;
}

export interface EnterSuccess {
  type: "success";
  artifact: Artifact;
  decision: ExecuteDecision;
  record: RunRecord;
  /** 如果本次运行调用了 L1 Craft */
  craft?: EnterCraftInfo;
}

export interface EnterEscalate {
  type: "escalate";
  upgrade: Upgrade;
  decision: EscalateDecision;
  record: RunRecord;
  /** 如果 L1 已被调用但仍不足 */
  craft?: EnterCraftInfo;
}

export type EnterResult = EnterSuccess | EnterEscalate;

// ── LLM 调用辅助 ───────────────────────────────────────

/** 多轮调用（通过 SessionRecorder 获取历史） */
async function callL0WithHistory(
  kernel: PiKernel,
  recorder: SessionRecorder,
  systemPrompt: string,
  onStream?: (text: string) => void,
): Promise<string> {
  const messages = recorder.getMessages();
  let llmOutput = "";
  for await (const event of kernel.promptMessages(messages, systemPrompt)) {
    if (event.type === "text_delta") {
      llmOutput = event.text;
      onStream?.(event.text);
    } else if (event.type === "message_end") {
      llmOutput = event.text;
    }
  }
  return llmOutput;
}

/** 单轮调用（首次决策，尚无历史） */
async function callL0First(
  kernel: PiKernel,
  request: string,
  systemPrompt: string,
  onStream?: (text: string) => void,
): Promise<string> {
  let llmOutput = "";
  for await (const event of kernel.prompt(request, systemPrompt)) {
    if (event.type === "text_delta") {
      llmOutput = event.text;
      onStream?.(event.text);
    } else if (event.type === "message_end") {
      llmOutput = event.text;
    }
  }
  return llmOutput;
}

// ── 恢复消息构造 ───────────────────────────────────────

/** 构造追加给 L0 的 L1 返回消息 */
function buildResumeMessage(
  craftOutput: CraftOutput,
  updatedSummaries: ArtifactSummary[],
): string {
  let msg = `L1 CraftEngine 已完成能力补充，以下是返回信息：\n\n`;
  msg += `## L1 Craft 报告\n\n${craftOutput.report}\n\n`;
  msg += `## 新增/更新的 Artifact\n\n`;
  msg += `- 文件路径: ${craftOutput.artifact_path}\n\n`;

  if (updatedSummaries.length > 0) {
    msg += `## 当前可用 Artifact（已重新加载）\n\n`;
    updatedSummaries.forEach((s, i) => {
      msg += `### ${i + 1}. ${s.header.title}\n`;
      msg += `- artifact_id: ${s.artifact_id}\n`;
      msg += `- when_to_use: ${s.header.when_to_use.join("、")}\n`;
      msg += `\n`;
    });
  }

  msg += `请参考以上 L1 报告，决定如何继续处理用户请求。\n`;
  msg += `输出格式不变：execute 或 escalate 的 JSON。\n`;

  return msg;
}

// ── EnterRuntime ────────────────────────────────────────

export interface EnterRuntimeConfig {
  user: string;
  runsDir: string;
  /** 会话记录目录（JSONL 持久化） */
  sessionsDir: string;
  artifactRegistry: ArtifactRegistry;
  kernel: PiKernel;
  /** L1 CraftEngine（可选 — 启用后 L0 升级时会调用 L1 生成/完善 Artifact） */
  craftEngine?: CraftEngine;
  /** 最大升级轮次（默认 1，即最多调用 L1 一次） */
  maxEscalations?: number;
  /** TUI 事件回调（可选 — 启用后实时发射运行事件） */
  onEvent?: (event: TuiEvent) => void;
}

export interface EnterRuntime {
  run(request: string): Promise<EnterResult>;
}

export function createEnterRuntime(config: EnterRuntimeConfig): EnterRuntime {
  const { user, runsDir, sessionsDir, artifactRegistry, kernel, craftEngine, onEvent } = config;
  const maxEscalations = craftEngine ? (config.maxEscalations ?? 1) : 0;

  const emit = (event: TuiEvent) => onEvent?.(event);

  return {
    async run(request: string) {
      const t0 = Date.now();
      const runId = generateRunId();
      let craftInfo: EnterCraftInfo | undefined;
      let craftApplied = false;

      emit({ type: "request", text: request, runId });

      // ── 创建会话记录器 ────────────────────────────────
      const recorder = await createSessionRecorder({
        sessionsDir,
        sessionId: runId,
        source: "l0-runtime",
        metadata: { user },
      });

      // updateHeader 非关键路径，失败不应阻塞主流程
      const safeUpdateHeader = async (update: { result?: string; artifact?: string; escalated?: boolean; craft_applied?: boolean }) => {
        try { await safeUpdateHeader(update); } catch { /* best effort */ }
      };

      // ── Round 0: 初始 L0 决策 ──────────────────────
      const summaries = await artifactRegistry.listHeaders(user);
      const systemPrompt = buildL0SystemPrompt(summaries);
      emit({ type: "headers_loaded", count: summaries.length });

      // 记录用户消息
      await recorder.append({
        role: "user",
        content: request,
        timestamp: Date.now(),
      });

      const initialOutput = await callL0First(
        kernel, request, systemPrompt,
        (text) => emit({ type: "l0_streaming", text }),
      );

      // 记录 L0 响应
      await recorder.append({
        role: "assistant",
        content: initialOutput,
        timestamp: Date.now(),
        metadata: { layer: "l0", round: 0 },
      });

      const initialDecision = parseDecision(initialOutput);
      emit({
        type: "l0_decision",
        action: initialDecision.action,
        ...(initialDecision.action === "execute" ? { artifact_id: initialDecision.artifact_id } : { reason: initialDecision.reason }),
      });

      // 直接执行
      if (initialDecision.action === "execute") {
        const artifact = await artifactRegistry.load(user, initialDecision.artifact_id);
        const record: RunRecord = {
          run_id: runId,
          request,
          used_artifact: initialDecision.artifact_id,
          escalated: false,
          craft_applied: false,
          result: "success",
        };
        await writeRunRecord(runsDir, record);
        emit({ type: "result", outcome: "success", totalMs: Date.now() - t0 });
        await safeUpdateHeader({ result: "success", artifact: initialDecision.artifact_id });
        return { type: "success", artifact, decision: initialDecision, record };
      }

      // ── 需要升级 → 调用 L1，然后 L0 恢复会话 ──────
      if (!craftEngine || maxEscalations < 1) {
        const upgrade: Upgrade = {
          request,
          current_artifact: null,
          why_not_enough: initialDecision.reason,
          known_facts: {},
        };
        const record: RunRecord = {
          run_id: runId,
          request,
          used_artifact: null,
          escalated: true,
          craft_applied: false,
          result: "partial",
        };
        await writeRunRecord(runsDir, record);
        emit({ type: "result", outcome: "partial", totalMs: Date.now() - t0 });
        await safeUpdateHeader({ result: "partial", escalated: true });
        return { type: "escalate", upgrade, decision: initialDecision, record };
      }

      // 调用 L1 CraftEngine
      const craftResult = await craftEngine.craft({
        request,
        problem: initialDecision.reason,
        current_artifact_id: null,
      });

      craftInfo = {
        report: craftResult.report,
        artifact_path: craftResult.artifact_path,
      };
      craftApplied = true;

      // 记录 L1 返回信息作为新的 user 消息
      const updatedSummaries = await artifactRegistry.listHeaders(user);
      const resumeMessage = buildResumeMessage(craftResult, updatedSummaries);
      await recorder.append({
        role: "user",
        content: resumeMessage,
        timestamp: Date.now(),
        metadata: { layer: "l1-craft-report", artifact_path: craftResult.artifact_path },
      });

      // ── L0 恢复会话：从 recorder 获取完整历史 ──
      emit({ type: "l0_resume", headersCount: updatedSummaries.length });
      const updatedSystemPrompt = buildL0SystemPrompt(updatedSummaries);
      const resumeOutput = await callL0WithHistory(
        kernel, recorder, updatedSystemPrompt,
        (text) => emit({ type: "l0_streaming", text }),
      );

      // 记录 L0 恢复后的响应
      await recorder.append({
        role: "assistant",
        content: resumeOutput,
        timestamp: Date.now(),
        metadata: { layer: "l0", round: 1, resumed: true },
      });

      const resumeDecision = parseDecision(resumeOutput);
      emit({
        type: "l0_decision",
        action: resumeDecision.action,
        ...(resumeDecision.action === "execute" ? { artifact_id: resumeDecision.artifact_id } : { reason: resumeDecision.reason }),
      });

      if (resumeDecision.action === "execute") {
        const artifact = await artifactRegistry.load(user, resumeDecision.artifact_id);
        const record: RunRecord = {
          run_id: runId,
          request,
          used_artifact: resumeDecision.artifact_id,
          escalated: true,
          craft_applied: true,
          result: "success",
        };
        await writeRunRecord(runsDir, record);
        emit({ type: "result", outcome: "success", totalMs: Date.now() - t0 });
        await safeUpdateHeader({ result: "success", craft_applied: true });
        return { type: "success", artifact, decision: resumeDecision, record, craft: craftInfo };
      }

      // L0 参考报告后仍然无法执行
      const upgrade: Upgrade = {
        request,
        current_artifact: null,
        why_not_enough: resumeDecision.reason,
        known_facts: {},
      };
      const record: RunRecord = {
        run_id: runId,
        request,
        used_artifact: null,
        escalated: true,
        craft_applied: true,
        result: "partial",
      };
      await writeRunRecord(runsDir, record);
      emit({ type: "result", outcome: "partial", totalMs: Date.now() - t0 });
      await safeUpdateHeader({ result: "partial", craft_applied: true });
      return { type: "escalate", upgrade, decision: resumeDecision, record, craft: craftInfo };
    },
  };
}
