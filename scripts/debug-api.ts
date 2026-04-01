/**
 * 调试脚本：展示 L0 完整的 API 交互过程
 *
 * 运行: npx tsx scripts/debug-api.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import { join } from "node:path";
import { createArtifactRegistry } from "@ethan-computer/artifact-registry";

const ROOT = join(__dirname, "..");

function buildSystemPrompt(
  summaries: Array<{
    artifact_id: string;
    header: { title: string; when_to_use: string[]; escalate_when: string[] };
  }>,
): string {
  let prompt = `你是 Ethan Computer 的 L0 执行层。你的职责是基于已有的 Artifact 执行用户请求。

## 当前可用的 Artifact

`;
  summaries.forEach((s, i) => {
    prompt += `### ${i + 1}. ${s.header.title}\n`;
    prompt += `- artifact_id: ${s.artifact_id}\n`;
    prompt += `- when_to_use: ${s.header.when_to_use.join("、")}\n`;
    prompt += `- escalate_when: ${s.header.escalate_when.join("、")}\n\n`;
  });

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

async function main() {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    baseURL: "https://open.bigmodel.cn/api/anthropic",
  });

  const registry = createArtifactRegistry(join(ROOT, "Workspace"));
  const summaries = await registry.listHeaders("ethan");

  // ── 展示注入的 headers ──
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  1. Artifact Headers 注入内容                    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  summaries.forEach((s) => {
    console.log(`  [${s.artifact_id}]`);
    console.log(`    title: ${s.header.title}`);
    console.log(`    when_to_use: ${s.header.when_to_use.join(", ")}`);
    console.log(`    derived_from: ${s.header.derived_from}`);
    console.log(`    escalate_when: ${s.header.escalate_when.join(", ")}`);
    console.log();
  });

  const systemPrompt = buildSystemPrompt(summaries);
  const userMessage = "帮我把这个需求拆成开发任务";

  // ── 展示完整 system prompt ──
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  2. System Prompt（发送给 LLM 的）               ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(systemPrompt);

  // ── 展示用户消息 ──
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  3. User Message                                 ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`  ${userMessage}\n`);

  // ── 调用 API ──
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  4. API 调用中...                                ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const response = await client.messages.create({
    model: "glm-5.1",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  // ── 展示 API 原始返回 ──
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  5. API 原始返回                                 ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`  model: ${response.model}`);
  console.log(`  stop_reason: ${response.stop_reason}`);
  console.log(`  input_tokens: ${response.usage.input_tokens}`);
  console.log(`  output_tokens: ${response.usage.output_tokens}`);
  console.log();

  const text = response.content
    .filter((b): b is Extract<(typeof response.content)[number], { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  console.log("  ── LLM 输出文本 ──\n");
  console.log(text);

  // ── 展示解析后的决策 ──
  console.log("\n\n╔══════════════════════════════════════════════════╗");
  console.log("║  6. 解析后的决策                                  ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const decision = JSON.parse(jsonMatch[0]);
    console.log(JSON.stringify(decision, null, 2));
  }
}

main().catch(console.error);
