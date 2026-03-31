/**
 * enter-runtime — L0 执行层（Agent Loop）
 *
 * L0 是一个 agent，拥有 tool use 能力：
 * - load_artifact(artifact_id): 加载 artifact 全文
 * - escalate(reason): 升级给 L1
 *
 * 流程：
 * 1. 接收用户请求
 * 2. 加载所有 Artifact Headers → 注入 system prompt
 * 3. L0 agent loop：LLM 自行决定加载 artifact、回复用户、或升级
 * 4. 如升级 → 调用 L1 → 注入结果 → L0 继续 loop
 * 5. L0 输出最终回复 → 结束
 *
 * 会话管理：
 * - 通过 SessionRecorder 记录每轮对话（即时 append JSONL）
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Artifact, Upgrade, RunRecord, TuiEvent } from "@ethan-computer/protocol-types";
import type { ArtifactRegistry, ArtifactSummary } from "@ethan-computer/artifact-registry";
import type { PiKernel, ChatMessage, ContentBlock, ToolDef } from "@ethan-computer/pi-kernel";
import type { CraftEngine, CraftOutput } from "@ethan-computer/craft-engine";
import {
  createSessionRecorder,
  type SessionRecorder,
} from "@ethan-computer/session-store";

// ── L0 Tool 定义 ──────────────────────────────────────────

const L0_TOOLS: ToolDef[] = [
  {
    name: "load_artifact",
    description: "加载指定 artifact 的完整内容（header + body）。在回复用户之前，你应该先加载匹配的 artifact 以获取执行细节和用户事实。",
    input_schema: {
      type: "object",
      properties: {
        artifact_id: {
          type: "string",
          description: "要加载的 artifact ID（从可用 artifact 列表中选择）",
        },
      },
      required: ["artifact_id"],
    },
  },
  {
    name: "escalate",
    description: "当没有可用的 artifact 能处理用户请求时，升级给 L1 CraftEngine 进行能力补充。",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "为什么当前 artifact 不足以处理此请求",
        },
      },
      required: ["reason"],
    },
  },
];

// ── System Prompt 构造 ──────────────────────────────────────

function buildL0SystemPrompt(summaries: ArtifactSummary[]): string {
  let prompt = `你是 Ethan Computer 的 L0 执行层。你是一个 agent，拥有工具调用能力，负责处理用户请求。

## 工作方式

1. 查看下方可用 Artifact 列表
2. 如果某个 Artifact 的 when_to_use 匹配当前请求 → 调用 load_artifact 加载全文
3. 根据 Artifact 内容直接回应用户（自然语言，不提及内部机制）
4. 如果没有匹配的 Artifact → 调用 escalate 并说明原因
5. 回复用户时简洁、有用、直接

## 当前可用的 Artifact

`;

  if (summaries.length === 0) {
    prompt += `（暂无可用 Artifact — 如果无法直接回答，请 escalate）\n`;
  } else {
    summaries.forEach((s, i) => {
      prompt += `### ${i + 1}. ${s.header.title}\n`;
      prompt += `- artifact_id: ${s.artifact_id}\n`;
      prompt += `- when_to_use: ${s.header.when_to_use.join("、")}\n`;
      prompt += `- escalate_when: ${s.header.escalate_when.join("、")}\n`;
      prompt += `\n`;
    });
  }

  prompt += `## 规则

- 优先使用已有的 Artifact，不要尝试自己回答超出 Artifact 范围的问题
- 加载 Artifact 后，根据其内容生成有用的回复
- 如果 Artifact 不够，调用 escalate
- 不要在回复中提及 Artifact、执行步骤、L0/L1 等内部机制
`;

  return prompt;
}

// ── RunRecord 写入 ─────────────────────────────────────────

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

// ── 结果类型 ────────────────────────────────────────────────

export interface EnterCraftInfo {
  report: string;
  artifact_path: string;
}

export interface EnterSuccess {
  type: "success";
  artifact: Artifact | null;
  record: RunRecord;
  craft?: EnterCraftInfo;
}

export interface EnterEscalate {
  type: "escalate";
  upgrade: Upgrade;
  record: RunRecord;
  craft?: EnterCraftInfo;
}

export type EnterResult = EnterSuccess | EnterEscalate;

// ── EnterRuntime ────────────────────────────────────────────

export interface EnterRuntimeConfig {
  user: string;
  runsDir: string;
  sessionsDir: string;
  artifactRegistry: ArtifactRegistry;
  kernel: PiKernel;
  craftEngine?: CraftEngine;
  maxEscalations?: number;
  maxIterations?: number;
  onEvent?: (event: TuiEvent) => void;
}

export interface EnterRuntime {
  run(request: string): Promise<EnterResult>;
}

export function createEnterRuntime(config: EnterRuntimeConfig): EnterRuntime {
  const { user, runsDir, sessionsDir, artifactRegistry, kernel, craftEngine, onEvent } = config;
  const maxEscalations = craftEngine ? (config.maxEscalations ?? 1) : 0;
  const maxIterations = config.maxIterations ?? 10;

  const emit = (event: TuiEvent) => onEvent?.(event);

  return {
    async run(request: string) {
      const t0 = Date.now();
      const runId = generateRunId();
      let craftInfo: EnterCraftInfo | undefined;
      let craftApplied = false;
      let escalated = false;
      let usedArtifact: string | null = null;

      emit({ type: "request", text: request, runId });

      // ── 创建会话记录器 ────────────────────────────────
      const recorder = await createSessionRecorder({
        sessionsDir,
        sessionId: runId,
        source: "l0-runtime",
        metadata: { user },
      });

      const safeUpdateHeader = async (update: Record<string, unknown>) => {
        try { await recorder.updateHeader(update); } catch { /* best effort */ }
      };

      // ── 加载 Artifact Headers ──────────────────────────
      let summaries = await artifactRegistry.listHeaders(user);
      emit({ type: "headers_loaded", count: summaries.length });

      // ── 构建初始消息 ───────────────────────────────────
      await recorder.append({ role: "user", content: request, timestamp: Date.now() });

      const messages: ChatMessage[] = [{ role: "user", content: request }];
      let escalationCount = 0;
      let finalText = "";

      // ── Agent Loop ─────────────────────────────────────
      for (let i = 0; i < maxIterations; i++) {
        const systemPrompt = buildL0SystemPrompt(summaries);

        const response = await kernel.callWithTools(
          messages, systemPrompt, L0_TOOLS,
          (text) => emit({ type: "l0_streaming", text }),
        );

        // 没有 tool call → agent 给出了最终回复
        if (response.stopReason !== "tool_use" || response.toolCalls.length === 0) {
          finalText = response.text;
          break;
        }

        // 处理 tool calls
        const assistantContent: ContentBlock[] = [];
        if (response.text) {
          assistantContent.push({ type: "text", text: response.text });
        }

        const toolResults: ContentBlock[] = [];
        for (const tc of response.toolCalls) {
          assistantContent.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });

          const t1 = Date.now();
          const result = await executeL0Tool(
            tc.name, tc.input,
            { user, artifactRegistry, craftEngine, request, emit, maxEscalations, escalationCount },
          );
          const elapsed = Date.now() - t1;

          emit({
            type: "l0_tool_call",
            tool: tc.name,
            summary: result.summary,
            ms: elapsed,
          });

          toolResults.push({
            type: "tool_result",
            tool_use_id: tc.id,
            content: result.content,
            is_error: result.isError ? true : undefined,
          });

          // 跟踪副作用
          if (tc.name === "load_artifact" && !result.isError) {
            usedArtifact = String(tc.input.artifact_id);
          }
          if (tc.name === "escalate" && !result.isError) {
            escalated = true;
            craftApplied = result.craftApplied ?? false;
            if (result.craftInfo) craftInfo = result.craftInfo;
            escalationCount++;
            // L1 完成后重新加载 headers
            summaries = await artifactRegistry.listHeaders(user);
          }
        }

        // 追加到消息历史
        messages.push({ role: "assistant", content: assistantContent });
        messages.push({ role: "user", content: toolResults });

        // 记录到 session
        await recorder.append({ role: "assistant", content: JSON.stringify(assistantContent), timestamp: Date.now(), metadata: { layer: "l0", round: i } });
        await recorder.append({ role: "user", content: JSON.stringify(toolResults), timestamp: Date.now(), metadata: { layer: "l0-tool-result", round: i } });
      }

      // ── 输出最终回复 ───────────────────────────────────
      if (finalText) {
        emit({ type: "l0_reply", text: finalText });
      }

      const record: RunRecord = {
        run_id: runId,
        request,
        used_artifact: usedArtifact,
        escalated,
        craft_applied: craftApplied,
        result: finalText ? "success" : "partial",
      };
      await writeRunRecord(runsDir, record);
      emit({ type: "result", outcome: finalText ? "success" : "partial", totalMs: Date.now() - t0 });
      await safeUpdateHeader({ result: finalText ? "success" : "partial", artifact: usedArtifact, escalated, craft_applied: craftApplied });

      if (finalText) {
        const artifact = usedArtifact ? await artifactRegistry.load(user, usedArtifact).catch(() => null) : null;
        return { type: "success", artifact, record, craft: craftInfo };
      }

      return {
        type: "escalate",
        upgrade: { request, current_artifact: usedArtifact, why_not_enough: "L0 agent loop exhausted without final reply", known_facts: {} },
        record,
        craft: craftInfo,
      };
    },
  };
}

// ── L0 Tool 执行 ────────────────────────────────────────────

interface ToolContext {
  user: string;
  artifactRegistry: ArtifactRegistry;
  craftEngine?: CraftEngine;
  request: string;
  emit: (event: TuiEvent) => void;
  maxEscalations: number;
  escalationCount: number;
}

interface ToolResult {
  content: string;
  summary: string;
  isError?: boolean;
  craftApplied?: boolean;
  craftInfo?: EnterCraftInfo;
}

async function executeL0Tool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  switch (name) {
    case "load_artifact": {
      const artifactId = String(input.artifact_id);
      try {
        const artifact = await ctx.artifactRegistry.load(ctx.user, artifactId);
        const steps = artifact.body.execution.map((s, i) => `${i + 1}. ${s}`).join("\n");
        const facts = Object.entries(artifact.body.user_facts)
          .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
          .join("\n");
        const content = [
          `# ${artifact.header.title}`,
          ``,
          `## When to use`,
          ...artifact.header.when_to_use.map(s => `- ${s}`),
          ``,
          `## User facts`,
          facts || "（无）",
          ``,
          `## Execution steps`,
          steps,
          ``,
          `## Escalate when`,
          ...artifact.header.escalate_when.map(s => `- ${s}`),
        ].join("\n");
        return { content, summary: `loaded ${artifactId}` };
      } catch (err) {
        return {
          content: `Error: artifact "${artifactId}" not found`,
          summary: `not found: ${artifactId}`,
          isError: true,
        };
      }
    }

    case "escalate": {
      const reason = String(input.reason);
      ctx.emit({ type: "l0_decision", action: "escalate", reason });

      if (!ctx.craftEngine || ctx.escalationCount >= ctx.maxEscalations) {
        return {
          content: "升级功能暂不可用。请尝试用现有信息回答用户。",
          summary: "escalation unavailable",
          isError: true,
        };
      }

      // 调用 L1
      const craftResult = await ctx.craftEngine.craft({
        request: ctx.request,
        problem: reason,
        current_artifact_id: null,
      });

      ctx.emit({ type: "l0_resume", headersCount: (await ctx.artifactRegistry.listHeaders(ctx.user)).length });

      const updatedSummaries = await ctx.artifactRegistry.listHeaders(ctx.user);
      const headersInfo = updatedSummaries.map(s =>
        `- ${s.artifact_id}: ${s.header.title} (when: ${s.header.when_to_use.join("、")})`
      ).join("\n");

      const content = [
        `L1 CraftEngine 已完成能力补充。`,
        ``,
        `## Craft 报告`,
        craftResult.report,
        ``,
        `## 新增/更新的 Artifact`,
        `- 路径: ${craftResult.artifact_path}`,
        ``,
        `## 当前可用 Artifact`,
        headersInfo,
      ].join("\n");

      return {
        content,
        summary: `L1 completed → ${craftResult.artifact_path.split("/").pop()}`,
        craftApplied: true,
        craftInfo: { report: craftResult.report, artifact_path: craftResult.artifact_path },
      };
    }

    default:
      return { content: `Unknown tool: ${name}`, summary: `unknown: ${name}`, isError: true };
  }
}
