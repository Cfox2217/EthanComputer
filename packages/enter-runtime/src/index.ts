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

import { writeFile, mkdir, readFile, readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { exec } from "node:child_process";
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
  {
    name: "read_file",
    description: "读取指定路径的文件内容。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径（绝对或相对路径）" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "将内容写入指定路径的文件。如果目录不存在会自动创建。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径（绝对或相对路径）" },
        content: { type: "string", description: "要写入的文件内容" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "对已有文件做定点修改。用 old_string 匹配要替换的内容，用 new_string 替换。必须精确匹配文件中的一段内容。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径（绝对或相对路径）" },
        old_string: { type: "string", description: "要替换的原文本（必须精确匹配）" },
        new_string: { type: "string", description: "替换后的新文本" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "list_directory",
    description: "列出指定目录下的文件和子目录。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "目录路径（绝对或相对路径）" },
      },
      required: ["path"],
    },
  },
  {
    name: "run_command",
    description: "执行 shell 命令并返回输出。用于构建、测试、运行脚本等操作。",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "要执行的 shell 命令" },
        timeout: { type: "number", description: "超时时间（毫秒），默认 30000" },
      },
      required: ["command"],
    },
  },
];

// ── System Prompt 构造 ──────────────────────────────────────

function buildL0SystemPrompt(summaries: ArtifactSummary[], userPrompt?: string): string {
  let prompt = `你是 Ethan Computer 的 L0 执行层。
你是用户可见的执行 agent。
你只基于当前可用的 Artifact 执行，不直接回溯 Skill，不自行做广义能力工程。

## 唯一职责

优先使用已有 Artifact 完成当前请求；
若现有 Artifact 不足，则升级给 L1；
L1 返回后，继续执行。

## 决策规则

对每个候选 Artifact，只判断以下四件事：

1. 当前请求的核心意图，是否落在该 Artifact 的 \`When to use\` 范围内
2. 该 Artifact 的 \`Execution\` 是否足以直接指导本次任务
3. 当前请求是否命中该 Artifact 的 \`Escalate when\`
4. 完成当前执行路径所需的 capabilities，是否已被该 Artifact 声明且被 Runtime 授予

决策方式：
- 四项都满足 → 直接执行
- 任一明确不满足 → 升级给 L1
- 判断模糊 → 优先尝试执行；若执行后仍存在边界不清，在最终回复末尾用一句话标注边界，不解释内部机制

## 能力边界

- 你只能使用当前 Artifact 已声明且 Runtime 已授予的 capabilities
- 你不能自行扩权
- 如果完成当前执行路径需要超出当前范围的能力，直接升级给 L1
- 如果 Runtime 未授予某项必要 capability，直接升级给 L1，不假装完成

## 执行流程

1. 读取当前注入的 Artifact headers
2. 决定直接执行某个 Artifact，或升级给 L1
3. 若升级，则把以下信息传给 L1：用户当前请求、当前尝试依赖的 Artifact（如有）、当前为什么不足、已知 facts
4. L1 返回后，重新读取更新后的 Artifact，并继续执行
5. 写入本次运行记录

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

  prompt += `## 面向用户的输出规范

- 直接给出有用结果
- 不解释内部机制
- 不提及 Artifact、Skill、L0、L1、upgrade、craft、runtime 等系统词
- 不伪造执行结果
- 若本次执行存在边界模糊，可在回复末尾用一句话标注，不展开解释

## 降级规则

如果当前无可用 Artifact，且无法直接完成请求：
- 立即升级给 L1
- 不要越权执行
- 不要伪造结果
`;

  if (userPrompt) {
    prompt += `\n---\n\n## 用户自定义指令\n> 以下内容为用户配置内容，为最高优先级参考内容。\n\n${userPrompt}\n`;
  }

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
  /** 本次 run 的完整消息历史（含初始消息 + agent loop 所有轮次） */
  messages: ChatMessage[];
}

export interface EnterEscalate {
  type: "escalate";
  upgrade: Upgrade;
  record: RunRecord;
  craft?: EnterCraftInfo;
  messages: ChatMessage[];
}

export type EnterResult = EnterSuccess | EnterEscalate;

// ── EnterRuntime ────────────────────────────────────────────

export interface EnterRuntimeConfig {
  user: string;
  workspaceDir: string;
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
  run(request: string, priorMessages?: ChatMessage[]): Promise<EnterResult>;
}

export function createEnterRuntime(config: EnterRuntimeConfig): EnterRuntime {
  const { user, workspaceDir, runsDir, sessionsDir, artifactRegistry, kernel, craftEngine, onEvent } = config;
  const maxEscalations = craftEngine ? (config.maxEscalations ?? 1) : 0;
  const maxIterations = config.maxIterations ?? 10;

  const emit = (event: TuiEvent) => onEvent?.(event);

  // ── 加载用户自定义系统提示词（创建时读取一次） ─────────
  let userPrompt = "";
  try {
    const promptPath = join(workspaceDir, user, "l0-system-prompt.md");
    userPrompt = readFileSync(promptPath, "utf-8").trim();
  } catch {
    // 文件不存在 → 无自定义提示词
  }

  return {
    async run(request: string, priorMessages?: ChatMessage[]) {
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

      const messages: ChatMessage[] = [
      ...(priorMessages || []),
      { role: "user", content: request },
    ];
      let escalationCount = 0;
      let finalText = "";

      // ── Agent Loop ─────────────────────────────────────
      for (let i = 0; i < maxIterations; i++) {
        const systemPrompt = buildL0SystemPrompt(summaries, userPrompt);

        const response = await kernel.callWithTools(
          messages, systemPrompt, L0_TOOLS,
          (text) => emit({ type: "l0_streaming", text }),
          (text) => emit({ type: "l0_thinking", text }),
        );

        // 没有 tool call → agent 给出了最终回复
        if (response.stopReason !== "tool_use" || response.toolCalls.length === 0) {
          finalText = response.text;
          break;
        }

        // 保存 agent 本轮推理文本
        // 模型可能输出文本，也可能直接调用工具不给文本
        // fallback: 从 tool call 的 input 参数提取决策理由
        let reasoning = response.text || "";
        if (!reasoning) {
          for (const tc of response.toolCalls) {
            if (tc.name === "escalate" && tc.input.reason) {
              reasoning = String(tc.input.reason);
            } else if (tc.name === "load_artifact" && tc.input.artifact_id) {
              reasoning = `加载 artifact: ${tc.input.artifact_id}`;
            }
          }
        }
        if (reasoning) {
          emit({ type: "l0_agent_reasoning", round: i + 1, text: reasoning });
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
            round: i + 1,
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
        // 将最终回复追加到消息历史，确保下一轮对话能看到本轮回复
        messages.push({ role: "assistant", content: [{ type: "text", text: finalText }] });
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
        return { type: "success", artifact, record, craft: craftInfo, messages };
      }

      return {
        type: "escalate",
        upgrade: { request, current_artifact: usedArtifact, why_not_enough: "L0 agent loop exhausted without final reply", known_facts: {} },
        record,
        craft: craftInfo,
        messages,
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

    case "read_file": {
      const filePath = String(input.path);
      try {
        const content = await readFile(filePath, "utf-8");
        const lines = content.split("\n").length;
        return { content, summary: `read ${filePath} (${lines} lines)` };
      } catch (err: any) {
        return { content: `Error reading file: ${err.message}`, summary: `read error: ${filePath}`, isError: true };
      }
    }

    case "write_file": {
      const filePath = String(input.path);
      const content = String(input.content);
      try {
        const dir = filePath.substring(0, filePath.lastIndexOf("/"));
        await mkdir(dir, { recursive: true });
        await writeFile(filePath, content, "utf-8");
        return { content: `文件已写入: ${filePath}`, summary: `wrote ${filePath}` };
      } catch (err: any) {
        return { content: `Error writing file: ${err.message}`, summary: `write error: ${filePath}`, isError: true };
      }
    }

    case "edit_file": {
      const filePath = String(input.path);
      const oldStr = String(input.old_string);
      const newStr = String(input.new_string);
      try {
        const content = await readFile(filePath, "utf-8");
        if (!content.includes(oldStr)) {
          return { content: `Error: old_string not found in ${filePath}`, summary: `edit miss: ${filePath}`, isError: true };
        }
        const newContent = content.replace(oldStr, newStr);
        await writeFile(filePath, newContent, "utf-8");
        return { content: `文件已修改: ${filePath}`, summary: `edited ${filePath}` };
      } catch (err: any) {
        return { content: `Error editing file: ${err.message}`, summary: `edit error: ${filePath}`, isError: true };
      }
    }

    case "list_directory": {
      const dirPath = String(input.path);
      try {
        const entries = await readdir(dirPath);
        const results: string[] = [];
        for (const entry of entries) {
          const fullPath = join(dirPath, entry);
          const s = await stat(fullPath);
          results.push(s.isDirectory() ? `${entry}/` : entry);
        }
        const content = results.join("\n") || "（空目录）";
        return { content, summary: `listed ${dirPath} (${results.length} entries)` };
      } catch (err: any) {
        return { content: `Error listing directory: ${err.message}`, summary: `list error: ${dirPath}`, isError: true };
      }
    }

    case "run_command": {
      const cmd = String(input.command);
      const timeout = Number(input.timeout) || 30000;
      try {
        const result = await new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
          exec(cmd, { timeout }, (error, stdout, stderr) => {
            resolve({ stdout, stderr, code: error ? (error as any).code ?? 1 : 0 });
          });
        });
        const output = [
          `Exit code: ${result.code}`,
          result.stdout ? `stdout:\n${result.stdout}` : "",
          result.stderr ? `stderr:\n${result.stderr}` : "",
        ].filter(Boolean).join("\n");
        return { content: output, summary: `ran: ${cmd.substring(0, 50)} (exit ${result.code})` };
      } catch (err: any) {
        return { content: `Error running command: ${err.message}`, summary: `cmd error: ${cmd.substring(0, 30)}`, isError: true };
      }
    }

    default:
      return { content: `Unknown tool: ${name}`, summary: `unknown: ${name}`, isError: true };
  }
}
