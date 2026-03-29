/**
 * enter-runtime — L0 执行层
 *
 * MVP 主流程：
 * 1. 接收用户请求
 * 2. 加载所有 Artifact Headers → 注入 system prompt
 * 3. LLM 自己判断用哪个 Artifact 或升级
 * 4. 根据决策执行或构造 Upgrade
 * 5. 写入 RunRecord
 */
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
// ── System Prompt 构造 ──────────────────────────────────
function buildL0SystemPrompt(summaries) {
    let prompt = `你是 Ethan Computer 的 L0 执行层。你的职责是基于已有的 Artifact 执行用户请求。

## 当前可用的 Artifact

`;
    if (summaries.length === 0) {
        prompt += `（暂无可用 Artifact）\n`;
    }
    else {
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
function parseDecision(llmOutput) {
    // 去掉可能的 markdown 代码块标记
    const cleaned = llmOutput
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
    // 尝试从输出中提取 JSON
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return { action: "escalate", reason: "无法解析 LLM 输出为决策" };
    }
    try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.action === "execute" && parsed.artifact_id) {
            return parsed;
        }
        if (parsed.action === "escalate") {
            return parsed;
        }
        return { action: "escalate", reason: "LLM 输出格式不正确" };
    }
    catch {
        return { action: "escalate", reason: "LLM 输出 JSON 解析失败" };
    }
}
// ── RunRecord 写入 ─────────────────────────────────────
let runCounter = 0;
function generateRunId() {
    runCounter++;
    return `run_${String(runCounter).padStart(4, "0")}`;
}
async function writeRunRecord(runsDir, record) {
    const logsDir = join(runsDir, "logs");
    await mkdir(logsDir, { recursive: true });
    await writeFile(join(logsDir, `${record.run_id}.yaml`), yaml.dump(record, { lineWidth: -1 }), "utf-8");
}
export function createEnterRuntime(config) {
    const { user, runsDir, artifactRegistry, kernel } = config;
    return {
        async run(request) {
            const runId = generateRunId();
            // 1. 加载所有 Artifact Headers
            const summaries = await artifactRegistry.listHeaders(user);
            // 2. 构造 system prompt（注入所有 headers）
            const systemPrompt = buildL0SystemPrompt(summaries);
            // 3. 发给 LLM → 拿到决策
            let llmOutput = "";
            for await (const event of kernel.prompt(request, systemPrompt)) {
                if (event.type === "text_delta") {
                    llmOutput += event.text;
                }
                else if (event.type === "message_end") {
                    llmOutput = event.text; // 完整文本
                }
            }
            // 4. 解析决策
            const decision = parseDecision(llmOutput);
            if (decision.action === "execute") {
                // 5a. 加载完整 Artifact
                const artifact = await artifactRegistry.load(user, decision.artifact_id);
                const record = {
                    run_id: runId,
                    request,
                    used_artifact: decision.artifact_id,
                    escalated: false,
                    craft_applied: false,
                    result: "success",
                };
                await writeRunRecord(runsDir, record);
                return { type: "success", artifact, decision, record };
            }
            // 5b. 构造 Upgrade
            const upgrade = {
                request,
                current_artifact: null,
                why_not_enough: decision.reason,
                known_facts: {},
            };
            const record = {
                run_id: runId,
                request,
                used_artifact: null,
                escalated: true,
                craft_applied: false,
                result: "partial",
            };
            await writeRunRecord(runsDir, record);
            return { type: "escalate", upgrade, decision, record };
        },
    };
}
//# sourceMappingURL=index.js.map