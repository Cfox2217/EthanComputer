/**
 * 验证 L0 Artifact Header 注入 + LLM 决策
 *
 * 运行: npx tsx scripts/verify-step3.ts
 */

import { join } from "node:path";
import { createArtifactRegistry } from "@ethan-computer/artifact-registry";
import { createPiKernel } from "@ethan-computer/pi-kernel";
import { createEnterRuntime } from "@ethan-computer/enter-runtime";

const ROOT = join(__dirname, "..");

async function main() {
  // 1. 创建内核
  const kernel = createPiKernel({
    mode: "direct-llm",
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: "glm-5.1",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
  });

  await kernel.start();

  // 2. 创建 registry 和 runtime
  const artifactRegistry = createArtifactRegistry(join(ROOT, "Workspace"));
  const enter = createEnterRuntime({
    user: "ethan",
    runsDir: join(ROOT, "runs"),
    sessionsDir: join(ROOT, "runs", "sessions"),
    artifactRegistry,
    kernel,
  });

  // 测试 1: 匹配请求
  console.log("=== Test 1: 应命中 task-breakdown artifact ===\n");
  const r1 = await enter.run("帮我把这个需求拆成开发任务");
  console.log(`type: ${r1.type}`);
  if (r1.type === "success") {
    console.log(`artifact_id: ${r1.artifact.artifact_id}`);
    console.log(`execution_plan: ${r1.decision.execution_plan}`);
  } else {
    console.log(`reason: ${r1.decision.reason}`);
  }
  console.log(`run_id: ${r1.record.run_id}`);

  // 测试 2: 不匹配请求
  console.log("\n=== Test 2: 应升级 ===\n");
  const r2 = await enter.run("帮我写一个数据库迁移脚本");
  console.log(`type: ${r2.type}`);
  if (r2.type === "escalate") {
    console.log(`reason: ${r2.decision.reason}`);
  }
  console.log(`run_id: ${r2.record.run_id}`);

  await kernel.stop();
}

main().catch(console.error);
