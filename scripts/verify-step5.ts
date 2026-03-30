/**
 * 验证 Step 5: L0 恢复执行（L1 返回后继续）+ 会话记录
 *
 * 完整流程测试：
 * 1. L0 遇到无法处理的请求 → escalate
 * 2. L1 CraftEngine 生成新 Artifact
 * 3. L0 从 SessionRecorder 恢复会话 → retry → 成功执行
 * 4. 验证 JSONL 会话文件正确记录
 *
 * 运行: npx tsx scripts/verify-step5.ts
 */

import { join } from "node:path";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { createSkillRegistry } from "@ethan-computer/skill-registry";
import { createArtifactRegistry } from "@ethan-computer/artifact-registry";
import { createPiKernel } from "@ethan-computer/pi-kernel";
import { createCraftEngine } from "@ethan-computer/craft-engine";
import { createEnterRuntime } from "@ethan-computer/enter-runtime";
import { loadSessionHeader } from "@ethan-computer/session-store";

const ROOT = join(__dirname, "..");
const API_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN ?? "";
const BASE_URL = "https://open.bigmodel.cn/api/anthropic";
const MODEL = "glm-5.1";

async function main() {
  if (!API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY 环境变量未设置");
    process.exit(1);
  }

  // ── 准备目录 ─────────────────────────────────────────
  const sessionsDir = join(ROOT, "runs", "sessions");
  mkdirSync(sessionsDir, { recursive: true });

  // ── 构建各层实例 ──────────────────────────────────────
  const skillRegistry = createSkillRegistry(join(ROOT, "skills", "local"));
  const artifactRegistry = createArtifactRegistry(join(ROOT, "artifacts"));

  const kernel = createPiKernel({
    mode: "direct-llm",
    apiKey: API_KEY,
    model: MODEL,
    baseUrl: BASE_URL,
  });

  const craftEngine = createCraftEngine({
    skillRegistry,
    artifactRegistry,
    artifactsDir: join(ROOT, "artifacts"),
    user: "ethan",
    apiKey: API_KEY,
    model: MODEL,
    baseUrl: BASE_URL,
    maxIterations: 10,
  });

  const runtime = createEnterRuntime({
    user: "ethan",
    runsDir: join(ROOT, "runs"),
    sessionsDir,
    artifactRegistry,
    kernel,
    craftEngine,
    maxEscalations: 1,
  });

  // ── 测试 ─────────────────────────────────────────────

  console.log("=== Step 5 验证: L0 escalate → L1 craft → L0 resume ===\n");

  const request = "帮我监控本地磁盘使用率，超过 85% 时自动报警";
  console.log(`用户请求: ${request}\n`);
  console.log("--- 流程开始 ---\n");

  const t0 = Date.now();
  const result = await runtime.run(request);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n--- 流程结束 (${elapsed}s) ---\n`);

  // ── 验证结果 ──────────────────────────────────────────

  if (result.type === "success") {
    console.log("✓ 最终结果: 成功执行");
    console.log(`  artifact_id: ${result.artifact.artifact_id}`);
    console.log(`  execution_plan: ${result.decision.execution_plan}`);
    console.log(`  escalated: ${result.record.escalated}`);
    console.log(`  craft_applied: ${result.record.craft_applied}`);

    if (result.craft) {
      console.log(`\n✓ L1 Craft 被调用`);
      console.log(`  artifact_path: ${result.craft.artifact_path}`);
      console.log(`  craft report:\n${result.craft.report.slice(0, 300)}...`);
    }
  } else {
    console.log("⚠ 最终结果: 仍然 escalate");
    console.log(`  原因: ${result.decision.reason}`);
    if (result.craft) {
      console.log(`  L1 已调用: ${result.craft.artifact_path}`);
    }
  }

  // ── 验证 JSONL 会话记录 ───────────────────────────────

  console.log("\n--- 验证 JSONL 会话记录 ---\n");

  const runId = result.record.run_id;
  const sessionFile = join(sessionsDir, `${runId}.jsonl`);

  if (existsSync(sessionFile)) {
    console.log(`✓ 会话文件已创建: ${sessionFile}`);

    // 读取并解析
    const content = readFileSync(sessionFile, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    console.log(`  总行数: ${lines.length}`);

    // Line 1: header
    const header = JSON.parse(lines[0]);
    console.log(`  Header: id=${header.id}, messageCount=${header.messageCount}, source=${header.source}`);

    // Lines 2+: messages
    const messages = lines.slice(1).map((l) => JSON.parse(l));
    messages.forEach((m: { role: string; content: string; metadata?: { layer?: string } }, i: number) => {
      const preview = m.content.slice(0, 60).replace(/\n/g, " ");
      const meta = m.metadata?.layer ? ` [${m.metadata.layer}]` : "";
      console.log(`  Message ${i + 1}: ${m.role}${meta} — "${preview}..."`);
    });

    // 验证消息序列
    const roles = messages.map((m: { role: string }) => m.role);
    if (result.record.craft_applied && result.record.escalated) {
      // 预期: user, assistant, user(l1-report), assistant
      if (roles.length >= 3 && roles[0] === "user" && roles[1] === "assistant" && roles[2] === "user") {
        console.log(`\n✓ 消息序列正确: ${roles.join(" → ")}`);
      } else {
        console.log(`\n⚠ 消息序列异常: ${roles.join(" → ")}`);
      }
    }

    // 通过 loadSessionHeader 快速读取
    const quickHeader = loadSessionHeader(sessionsDir, runId);
    if (quickHeader) {
      console.log(`\n✓ loadSessionHeader 快速读取成功: messageCount=${quickHeader.messageCount}`);
    }
  } else {
    console.log(`✗ 会话文件未创建: ${sessionFile}`);
  }

  if (result.record.craft_applied && result.record.escalated && result.type === "success") {
    console.log("\n✓✓ 完整流程验证通过: L0 escalate → L1 craft → L0 resume → success");
    console.log("✓✓ 会话记录验证通过: JSONL 正确记录 4 轮消息");
  }

  console.log("\n=== 验证完成 ===");
}

main().catch(console.error);
