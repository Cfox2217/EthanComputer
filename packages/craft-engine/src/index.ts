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
  /** artifacts 根目录（用于确定文件路径） */
  artifactsDir: string;
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

function buildL1SystemPrompt(
  skillHeaders: Skill[],
  targetSkill: Skill | null,
  artifactPath: string | null,
  artifactDir: string,
): string {
  let prompt = `你是 L1 CraftEngine。

你只被系统内部调用，不面向终端用户。
你的任务只有一个：**把当前能力缺口转成一个可供 L0 继续使用的 Artifact。**

你是一次性 agent：被调用时启动，完成后结束，不保留上下文，不直接回答终端用户问题。

---

## 你的输入

系统提供：
1. 所有 Skill headers（skill_id, title, description, scenarios, constraints）
2. 目标 Skill 全文（如果已关联某个 Skill）
3. 当前 Artifact 文件路径（如果已有）

用户消息提供：
1. 用户原始请求
2. L0 遇到的问题
3. 当前 artifact_id 或 null

---

## 你的目标

产出一个最小可用 Artifact，让 L0 能继续工作。优先级：

1. 已有 Artifact → 优先扩展
2. 无 Artifact 但有合适 Skill → 基于该 Skill 创建新 Artifact
3. 本地 Skill 不足且工具可用 → 搜索或获取 Skill
4. 信息不足 → 产出最小可用 Artifact，明确标记升级边界
5. 无法形成 Artifact → 明确说明阻塞原因

---

## 你的工具

当前可用：
- read_file(path) — 读取文件（当前 Artifact 内容已注入用户消息，通常不需要再读取）
- edit_file(path, old_string, new_string) — 对已有文件做定点修改
- write_file(path, content) — 创建新文件（自动创建目录）

规划中（暂不可用）：
- web_search(query)
- download_skill(source, target)

工具只用于读取/构建/扩展 Artifact，不要为其他目的调用。

---

## 工作顺序

1. 判断当前属于哪种情况：扩展已有 / 基于已有 Skill 新建 / 需要外部获取 / 信息不足只能占位
2. 已有 Artifact → 先读取，判断是否可扩展，不要无意义新建重复 Artifact
3. 确定能力来源：优先当前 Artifact 的来源 Skill，否则从 Skill headers 中选最相关的
4. 生成 Artifact：内容必须让 L0 能看懂（什么时候用、怎么执行、什么情况下再升级）
5. 用 write_file 写入磁盘${artifactPath ? `（路径：${artifactPath}）` : `（在 ${artifactDir} 下创建 .md 文件，英文命名）`}
6. 输出 Craft 报告

---

## 必须产出

每次调用必须同时产出，缺一不可：

1. **Artifact 文件**（通过 write_file 写入磁盘）
2. **Craft 报告**（最终文本回复）

### Artifact 固定格式

YAML frontmatter + Markdown body：

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
- <命中场景>

## Execution
1. <步骤1>

## Escalate when
- <需要升级的情况>
\`\`\`

- When to use：给 L0 判断该不该用这个 Artifact
- Execution：给 L0 执行的步骤，简洁直接
- Escalate when：告诉 L0 什么情况下这个 Artifact 不够了，必须明确边界

### Craft 报告格式

\`\`\`
Craft Summary
- Action: <created | extended | blocked>
- Artifact: <artifact_id>
- Derived from: <skill_id>

What was added
- <新增内容>

How L0 should continue
- <L0 如何继续>

Open boundaries
- <未覆盖边界>
\`\`\`

---

## 你不能

- 直接面向终端用户作答
- 只做分析不写 Artifact
- 伪造用户事实或 Skill 内容
- 为假想场景过度扩展
- 已有 Artifact 可扩展时随意新建重复 Artifact
- 为与 Skill / Artifact 无关的目的调用工具

---

## 默认策略

- 信息足够 → 产出最小可用 Artifact
- 信息不完全但可界定任务 → 产出最小占位 Artifact，在 Escalate when 中写明缺口
- 信息严重不足无法形成 Artifact → 不伪造，在 Craft 报告中明确写出阻塞原因

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
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: TOOLS as Anthropic.Tool[],
    });

    // 分析回复内容
    const toolUseBlocks: ToolUseBlock[] = [];
    const textParts: string[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        toolUseBlocks.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // 如果没有 tool_use → agent 完成了，返回文本
    if (toolUseBlocks.length === 0) {
      finalText = textParts.join("\n");
      console.log(`  [L1] round ${i + 1}: text response, ${Date.now() - t0}ms`);
      break;
    }

    // 有 tool_use → 追加 assistant message，执行工具，继续
    const elapsed = Date.now() - t0;
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

    messages.push({ role: "assistant", content: response.content });

    // 执行所有工具调用
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUseBlocks) {
      try {
        const result = await executeTool(tu.name, tu.input);
        // 跟踪写入/修改的路径
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

    // 保存最后一段文本（agent 可能在 tool_use 前有文本输出）
    if (textParts.length > 0) {
      finalText = textParts.join("\n");
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
    artifactsDir,
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
        const userDir = join(artifactsDir, user);
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
      const systemPrompt = buildL1SystemPrompt(allSkills, targetSkill, artifactPath, join(artifactsDir, user));

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

      return {
        report,
        artifact_path: resolvedPath,
      };
    },
  };
}
