/**
 * craft-engine — L1 能力工程层
 *
 * 接收 L0 的 Upgrade 请求，回溯 Skill，通过 agentic loop 生成/完善 Artifact。
 *
 * 核心流程：
 * 1. 加载所有 Skill headers（注入 system prompt）
 * 2. 回溯目标 Skill 全文（如有）
 * 3. 确定 artifact 路径（新建或已有）
 * 4. 启动 agentic loop（工具：read_file, write_file）
 * 5. 返回 craft report + artifact 路径
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Skill, TuiEvent } from "@ethan-computer/protocol-types";
import type { SkillRegistry } from "@ethan-computer/skill-registry";
import type { ArtifactRegistry } from "@ethan-computer/artifact-registry";

// ── 类型 ────────────────────────────────────────────────

export interface CraftRequest {
  /** 用户原始请求 */
  request: string;
  /** L0 遇到的具体问题 */
  problem: string;
  /** L0 提到的 artifact（null = 全新需求） */
  current_artifact_id: string | null;
}

export interface CraftOutput {
  /** Craft 报告：补了什么能力、简单指导 */
  report: string;
  /** Artifact 文件路径（L1 写入磁盘的文件） */
  artifact_path: string;
}

export interface CraftEngineConfig {
  /** Skill registry 实例 */
  skillRegistry: SkillRegistry;
  /** Artifact registry 实例 */
  artifactRegistry: ArtifactRegistry;
  /** workspace 根目录（如 "Workspace"） */
  workspaceDir: string;
  /** 用户标识 */
  user: string;
  /** Anthropic API key */
  apiKey: string;
  /** 模型名 */
  model: string;
  /** API base URL（智谱兼容端点） */
  baseUrl?: string;
  /** agentic loop 最大迭代次数 */
  maxIterations?: number;
  /** TUI 事件回调（可选） */
  onEvent?: (event: TuiEvent) => void;
}

export interface CraftEngine {
  craft(request: CraftRequest): Promise<CraftOutput>;
}

// ── System Prompt 构建 ──────────────────────────────────

async function buildL1SystemPrompt(
  skillHeaders: Skill[],
  targetSkill: Skill | null,
  artifactPath: string | null,
  artifactDir: string,
): Promise<string> {
  let prompt = `你是 L1 CraftEngine。
你只被系统内部调用，不面向终端用户。
你的唯一职责，是把当前能力缺口转成一个可供 L0 继续使用的 Artifact。

---

## 你的输入

系统提供：
1. 所有 Skill headers
2. 目标 Skill 全文（如已关联）
3. 当前 Artifact（可空）
4. 用户当前请求
5. L0 遇到的问题
6. 已知 facts

---

## 动作只允许三种

1. \`extend\` — 当前 Artifact 的核心执行路径与本次任务同类，可在原 Artifact 基础上扩展
2. \`create\` — 当前 Artifact 与本次任务不同类，需基于相关 Skill 新建 Artifact
3. \`block\` — 信息不足或 Skill 不足，只能生成最小占位 Artifact，并明确阻塞原因

核心判断：
- 若 \`current_artifact\` 非空，先判断其核心执行路径与本次请求是否同类
- 同类 → \`extend\`
- 不同类 → \`create\`
- 无法形成有效执行面 → \`block\`

---

## 生成原则

你生成的 Artifact 必须服务于 L0 的直接执行，而不是成为冗长的说明文档。

### 1. 最小可用原则
- 只裁剪本次任务真正需要的场景、步骤、facts、边界
- 不复制整份 Skill
- 不把 Skill 原文迁移进 Artifact
- 不为遥远未来场景过度扩展

### 2. 邻接式前瞻原则（允许多想一步）
你可以在不脱离当前任务类型的前提下，向前多想一步，为 L0 一并覆盖用户紧邻的下一步高概率行为，以减少后续重复 crafting。

但这种前瞻扩展必须同时满足：
- 与当前请求同类，而不是跨类型跳转
- 能由当前请求、已知 facts、现有执行路径直接推得
- 只覆盖"紧邻下一步"的高概率行为，不覆盖遥远未来场景
- 不引入新的核心协议、全新任务类型或重型治理对象
- 不让 Artifact 膨胀成笼统的大而全模板

如果以上任一条件不满足，则不要提前扩展。

### 3. 能力声明原则
你可以为 Artifact 注入完成当前执行路径所需的最小 capabilities 集合。
你注入的是 **capability declaration（能力需求声明）**，不是最终授权。

必须遵守：
- 只声明完成当前执行路径所需的最小 capabilities
- 若采用邻接式前瞻扩展，也只允许补入覆盖这"一步之内"所需的最小 capabilities
- 不为假想场景预装工具
- 不把通用工具包整体塞进 Artifact
- 不越过 Runtime 直接授予最终权限

### 4. 边界显式化原则
Artifact 必须明确写出：
- 什么时候可以直接使用
- 如何执行
- 在什么情况下必须再次升级
- 哪些能力缺口会触发升级

---

## 固定产出

每次调用必须同时产出两项，缺一不可：
1. **Artifact 文件**（通过 write_file 写入磁盘）
2. **Craft Report**（最终文本回复）

### Artifact 固定格式

\`\`\`
---
name: <artifact_id>
description: <一句话描述>
metadata:
  derived_from: <skill_id>
  version: "0.1.0"
---

# <标题>

## When to use
- <场景>

## Execution
1. <步骤>

## Capabilities
- <capability>

## Escalate when
- <边界>

## Known facts
- <事实>

## Notes
- （可选，仅保留必要说明）
\`\`\`

字段要求：
- When to use：给 L0 判断该不该用
- Execution：给 L0 直接执行
- Capabilities：声明完成当前执行路径所需的最小 capabilities
- Escalate when：显式写出执行边界与能力缺口
- Known facts：只写当前确定有用的事实
- Notes：仅在必要时保留，不要把它写成长文档

### 占位 Artifact（block 时）

若当前无法产出有效 Artifact，必须写出最小占位 Artifact：

\`\`\`
---
name: <artifact_id>
description: <描述>
metadata:
  status: blocked
  derived_from: <skill_id 或 unknown>
  version: "0.0.1"
---

# （占位）

## When to use
- （待补充）

## Execution
- （当前能力不足，无法生成执行路径）

## Capabilities
- （待补充）

## Escalate when
- 始终升级，直到该 Artifact 被正式填充

## Blocked reason
- <具体阻塞原因>
\`\`\`

### Craft Report 固定格式

\`\`\`
Craft Summary
- Action: <created | extended | blocked>
- Artifact: <artifact_id>
- Derived from: <skill_id>

What was added
- <新增内容>

Forward coverage
- 本次在不跨类型的前提下，额外覆盖了哪些"紧邻下一步"的高概率行为
- 若无，则写：无

Growth signal
- 本次扩展/新建后，以下类型的请求可由 L0 更直接处理，无需再次回溯同一能力源：
  - <场景描述1>

How L0 should continue
- <L0 如何继续>

Open boundaries
- <未覆盖边界>
\`\`\`

---

## 禁止事项

- 不直接面向终端用户作答
- 不在已有 Artifact 可扩展时无意义新建重复 Artifact
- 不伪造 Skill、facts、执行结果或边界
- 不为遥远未来场景过度扩展
- 不把 capability declaration 写成最终授权
- 不越过 Runtime 直接授予最终权限
- 不为了"看起来更强"而把 Artifact 做成重型模板

---

## 默认策略

- 信息足够 → 生成最小可用 Artifact
- 信息不全但能界定任务 → 生成最小占位 Artifact，并把缺口写清楚
- 如存在明显的紧邻下一步高概率行为，允许在同类范围内向前多想一步，减少后续返工
- 如这种前瞻扩展会引入新类型任务、重型能力或边界失真 → 不做，保持当前最小可用

---

## 输入数据

`;

  // ── 动态注入：Skill headers ──────────────────────────

  prompt += `### Skill Headers\n\n`;
  if (skillHeaders.length === 0) {
    prompt += `（暂无可用 Skill）\n`;
  } else {
    skillHeaders.forEach((s, i) => {
      prompt += `#### ${i + 1}. ${s.title}\n`;
      prompt += `- skill_id: ${s.skill_id}\n`;
      prompt += `- description: ${s.description}\n`;
      prompt += `- scenarios: ${s.scenarios.join("；")}\n`;
      prompt += `- constraints: ${s.constraints.join("；")}\n\n`;
    });
  }

  // ── 动态注入：目标 Skill 全文 ────────────────────────

  if (targetSkill) {
    prompt += `### 目标 Skill（全文）\n\n`;
    prompt += `- skill_id: ${targetSkill.skill_id}\n`;
    prompt += `- title: ${targetSkill.title}\n`;
    prompt += `- description: ${targetSkill.description}\n`;
    prompt += `- scenarios:\n`;
    targetSkill.scenarios.forEach((s) => { prompt += `  - ${s}\n`; });
    prompt += `- constraints:\n`;
    targetSkill.constraints.forEach((c) => { prompt += `  - ${c}\n`; });
    prompt += `\n`;
  }

  // ── 动态注入：当前 Artifact ──────────────────────────

  if (artifactPath) {
    prompt += `### 当前 Artifact\n\n`;
    prompt += `文件路径：${artifactPath}\n`;
    prompt += `当前内容已在下方用户消息中提供，直接基于它修改即可。\n\n`;
  }

  // ── 加载 CRAFT.md（每次调用读取） ─────────────────────
  try {
    const userDir = dirname(artifactDir);
    const promptPath = join(userDir, "CRAFT.md");
    const raw = (await readFile(promptPath, "utf-8")).trim();
    if (raw) {
      const marker = "<!-- prompt -->";
      const idx = raw.indexOf(marker);
      const userPrompt = idx >= 0
        ? raw.slice(idx + marker.length).trim()
        : raw;
      if (userPrompt) {
        prompt += `---\n\n## 用户自定义指令\n> 以下内容为用户配置内容，为最高优先级参考内容。\n\n${userPrompt}\n`;
      }
    }
  } catch {
    // 文件不存在 → 无自定义提示词
  }

  return prompt;
}

// ── 用户消息构建 ────────────────────────────────────────

async function buildUserMessage(
  req: CraftRequest,
  artifactPath: string | null,
): Promise<string> {
  let msg = `## L0 升级请求\n\n`;
  msg += `**用户原始请求**: ${req.request}\n\n`;
  msg += `**L0 遇到的问题**: ${req.problem}\n\n`;
  if (req.current_artifact_id && artifactPath) {
    msg += `**当前 Artifact**: ${req.current_artifact_id}\n\n`;
    msg += `文件路径：${artifactPath}\n\n`;
    // 直接注入当前内容，省去 read_file 轮次
    try {
      const content = await readFile(artifactPath, "utf-8");
      msg += `当前内容：\n\n${content}\n\n`;
      msg += `请基于以上内容直接修改，用 edit_file 做定点修改，或用 write_file 覆盖写入。\n`;
    } catch {
      msg += `（文件不存在，请用 write_file 创建新文件）\n`;
    }
  } else {
    msg += `这是一个全新需求，没有对应 Artifact。请基于匹配的 Skill 创建新 Artifact。\n`;
  }
  return msg;
}

// ── 工具定义 ────────────────────────────────────────────

const TOOLS = [
  {
    name: "read_file",
    description: "读取指定路径的文件内容。当前 Artifact 内容已预注入用户消息，通常不需要再调用此工具，除非需要读取其他文件。",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "文件绝对路径" },
      },
      required: ["path"],
    },
  },
  {
    name: "edit_file",
    description: "对已有文件做定点修改。用 old_string 匹配要替换的内容，用 new_string 替换。适合对已有 Artifact 做局部修改。",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "文件绝对路径" },
        old_string: { type: "string", description: "要替换的原文本（必须精确匹配文件中的一段内容）" },
        new_string: { type: "string", description: "替换后的新文本" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "write_file",
    description: "将内容写入指定路径的文件。用于创建新 Artifact。如果目录不存在会自动创建。",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "文件绝对路径" },
        content: { type: "string", description: "要写入的文件内容" },
      },
      required: ["path", "content"],
    },
  },
];

// ── Agentic Loop ────────────────────────────────────────

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AgentLoopResult {
  report: string;
  writtenFiles: string[];
}

async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  apiKey: string,
  model: string,
  baseUrl: string | undefined,
  maxIterations: number,
  onEvent?: (event: TuiEvent) => void,
): Promise<AgentLoopResult> {
  const client = new Anthropic({ apiKey, baseURL: baseUrl });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  let finalText = "";
  const writtenFiles: string[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const t0 = Date.now();

    // ── 流式调用 ──────────────────────────────────────
    let text = "";
    let thinkingText = "";
    const toolCalls: { id: string; name: string; input: Record<string, unknown> }[] = [];
    let currentTool: { id: string; name: string; input: string } | null = null;

    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: TOOLS as Anthropic.Tool[],
    });

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentTool = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: "",
          };
        }
      }
      if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          thinkingText += (event.delta as { type: "thinking_delta"; thinking: string }).thinking;
          onEvent?.({ type: "l1_thinking", text: thinkingText });
        }
        if (event.delta.type === "text_delta") {
          text += event.delta.text;
          onEvent?.({ type: "l1_streaming", text });
        }
        if (event.delta.type === "input_json_delta" && currentTool) {
          currentTool.input += event.delta.partial_json;
        }
      }
      if (event.type === "content_block_stop" && currentTool) {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(currentTool.input || "{}"); } catch { /* empty */ }
        toolCalls.push({ id: currentTool.id, name: currentTool.name, input: parsed });
        currentTool = null;
      }
    }

    const elapsed = Date.now() - t0;

    // ── 分析回复 ──────────────────────────────────────
    const toolUseBlocks: ToolUseBlock[] = toolCalls.map(tc => ({
      type: "tool_use" as const,
      id: tc.id,
      name: tc.name,
      input: tc.input,
    }));

    // 如果没有 tool_use → agent 完成了
    if (toolUseBlocks.length === 0) {
      finalText = text;
      console.log(`  [L1] round ${i + 1}: text response, ${elapsed}ms`);
      break;
    }

    console.log(`  [L1] round ${i + 1}: ${toolUseBlocks.map(t => t.name).join(", ")}, ${elapsed}ms`);

    for (const tu of toolUseBlocks) {
      const summary = tu.name === "write_file"
        ? `write → ${String(tu.input.path).split("/").pop()}`
        : tu.name === "edit_file"
          ? `edit → ${String(tu.input.path).split("/").pop()}`
          : tu.name;
      onEvent?.({
        type: "l1_tool_call",
        round: i + 1,
        tool: tu.name,
        summary,
        ms: elapsed,
      });
    }

    // 构建 assistant content（text + tool_use blocks）
    const assistantContent: Anthropic.ContentBlockParam[] = [];
    if (text) {
      assistantContent.push({ type: "text", text });
    }
    for (const tc of toolCalls) {
      assistantContent.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: tc.input,
      });
    }
    messages.push({ role: "assistant", content: assistantContent });

    // 执行所有工具调用
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUseBlocks) {
      try {
        const result = await executeTool(tu.name, tu.input);
        if ((tu.name === "write_file" || tu.name === "edit_file") && typeof tu.input.path === "string") {
          writtenFiles.push(tu.input.path);
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: result,
        });
      } catch (err) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });

    if (text) {
      finalText = text;
    }
  }

  if (!finalText) {
    finalText = "Agent reached max iterations without final text output.";
  }

  return { report: finalText, writtenFiles };
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "read_file": {
      const filePath = String(input.path);
      return await readFile(filePath, "utf-8");
    }
    case "edit_file": {
      const filePath = String(input.path);
      const oldString = String(input.old_string);
      const newString = String(input.new_string);
      const content = await readFile(filePath, "utf-8");
      if (!content.includes(oldString)) {
        throw new Error(`old_string not found in ${filePath}`);
      }
      const newContent = content.replace(oldString, newString);
      await writeFile(filePath, newContent, "utf-8");
      return `File edited successfully: ${filePath}`;
    }
    case "write_file": {
      const filePath = String(input.path);
      const content = String(input.content);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");
      return `File written successfully: ${filePath}`;
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── Artifact 路径确定 ───────────────────────────────────

/** 从 agent 执行结果中确定 artifact 路径 */
function resolveArtifactPath(
  writtenFiles: string[],
  candidatePath: string | null,
): string {
  // 优先用 write_file 实际写入的最后一个 .md 文件
  const mdFiles = writtenFiles.filter((f) => f.endsWith(".md"));
  if (mdFiles.length > 0) {
    return mdFiles[mdFiles.length - 1];
  }
  // 回退到候选路径（已有 artifact 的场景）
  if (candidatePath) {
    return candidatePath;
  }
  throw new Error(
    "Agent did not write any artifact file. Written files: " +
    (writtenFiles.length > 0 ? writtenFiles.join(", ") : "(none)"),
  );
}

// ── CraftEngine 创建 ────────────────────────────────────

export function createCraftEngine(config: CraftEngineConfig): CraftEngine {
  const {
    skillRegistry,
    artifactRegistry,
    workspaceDir,
    user,
    apiKey,
    model,
    baseUrl,
    maxIterations = 10,
    onEvent,
  } = config;

  const emit = (event: TuiEvent) => onEvent?.(event);

  return {
    async craft(req: CraftRequest): Promise<CraftOutput> {
      // 1. 加载所有 Skill headers
      const allSkills = await skillRegistry.loadAll();

      // 2. 确定目标 Skill 和 artifact 路径
      let targetSkill: Skill | null = null;
      let artifactPath: string | null = null;

      if (req.current_artifact_id) {
        // 已有 artifact → 加载它，回溯到源 Skill
        const userDir = join(workspaceDir, user, "artifacts");
        artifactPath = join(userDir, `${req.current_artifact_id}.md`);

        try {
          const artifact = await artifactRegistry.load(user, req.current_artifact_id);
          const derivedFrom = artifact.header.derived_from;
          if (derivedFrom) {
            try {
              targetSkill = await skillRegistry.load(derivedFrom);
            } catch {
              // Skill 不存在 → 继续无 targetSkill
            }
          }
        } catch {
          // artifact 不存在 → 路径保留，agent 需要新建
        }
      }

      emit({ type: "l1_start", skill: targetSkill?.skill_id ?? "(auto)" });

      // 3. 构建 system prompt
      const systemPrompt = await buildL1SystemPrompt(allSkills, targetSkill, artifactPath, join(workspaceDir, user, "artifacts"));

      // 4. 构建 user message（已有 artifact 时预注入内容）
      const userMessage = await buildUserMessage(req, artifactPath);

      // 5. 运行 agentic loop
      const { report, writtenFiles } = await runAgentLoop(
        systemPrompt,
        userMessage,
        apiKey,
        model,
        baseUrl,
        maxIterations,
        onEvent,
      );

      // 6. 确定 artifact 路径
      const resolvedPath = resolveArtifactPath(writtenFiles, artifactPath);

      // 提取 Craft Summary 中的关键信息
      const actionMatch = report.match(/Action:\s*(\w+)/);
      const summary = actionMatch ? actionMatch[1] : "completed";
      emit({ type: "l1_report", summary });

      // 提取 continue hint
      const continueMatch = report.match(/How L0 should continue\s*\n\s*-\s*(.+)/);
      const continueHint = continueMatch ? continueMatch[1].trim() : "";
      emit({
        type: "l1_craft_result",
        artifact_path: resolvedPath,
        summary,
        continue_hint: continueHint,
      });

      return {
        report,
        artifact_path: resolvedPath,
      };
    },
  };
}
