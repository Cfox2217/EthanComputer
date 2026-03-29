/**
 * 验证 L1 CraftEngine — Agentic Loop + Tool Use
 *
 * 测试两个场景：
 * 1. 全新需求 → L1 基于 Skill headers 思考 → 生成新 Artifact
 * 2. 已有 artifact 不足 → L1 读取 + 修改 Artifact
 *
 * 运行: npx tsx scripts/verify-craft.ts
 */

import { join } from "node:path";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { createSkillRegistry } from "@ethan-computer/skill-registry";
import { createArtifactRegistry } from "@ethan-computer/artifact-registry";
import { createCraftEngine } from "@ethan-computer/craft-engine";

const ROOT = join(__dirname, "..");
const API_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN ?? "";
const BASE_URL = "https://open.bigmodel.cn/api/anthropic";
const MODEL = "glm-5.1";

async function main() {
  if (!API_KEY) {
    console.error("ERROR: ANTHROPIC_API_KEY 环境变量未设置");
    process.exit(1);
  }

  const skillRegistry = createSkillRegistry(join(ROOT, "skills", "local"));
  const artifactRegistry = createArtifactRegistry(join(ROOT, "artifacts"));

  const engine = createCraftEngine({
    skillRegistry,
    artifactRegistry,
    artifactsDir: join(ROOT, "artifacts"),
    user: "ethan",
    apiKey: API_KEY,
    model: MODEL,
    baseUrl: BASE_URL,
    maxIterations: 10,
  });

  // ── Test 1: 全新需求 → 生成新 Artifact ──────────────
  console.log("=== Test 1: 全新需求 → 生成新 Artifact ===\n");

  const r1 = await engine.craft({
    request: "帮我写一个数据库迁移脚本，从 PostgreSQL 迁移到 MySQL",
    problem: "没有匹配的 Artifact 可以处理数据库迁移任务",
    current_artifact_id: null,
  });

  console.log("Craft report:");
  console.log(r1.report);
  console.log(`\nArtifact path: ${r1.artifact_path}`);

  // 验证文件存在
  if (existsSync(r1.artifact_path)) {
    console.log("✓ Artifact 文件已创建");
    const content = readFileSync(r1.artifact_path, "utf-8");
    console.log(`  文件大小: ${content.length} bytes`);
    console.log(`  前 200 字符:\n${content.slice(0, 200)}...\n`);
  } else {
    console.log("✗ Artifact 文件未创建");
  }

  // ── Test 2: 已有 artifact 不足 → 修改完善 ────────────
  console.log("\n=== Test 2: 已有 artifact 不足 → 修改完善 ===\n");

  // 检查已有 artifact
  const existingArtifacts = await artifactRegistry.listHeaders("ethan");
  console.log(`已有 ${existingArtifacts.length} 个 Artifact`);

  if (existingArtifacts.length > 0) {
    const targetId = existingArtifacts[0].artifact_id;
    console.log(`选择修改: ${targetId}\n`);

    const r2 = await engine.craft({
      request: "帮我拆分一个很复杂的需求，需要支持子任务依赖关系",
      problem: `当前 ${targetId} artifact 不支持子任务依赖关系的拆分`,
      current_artifact_id: targetId,
    });

    console.log("Craft report:");
    console.log(r2.report);
    console.log(`\nArtifact path: ${r2.artifact_path}`);

    if (existsSync(r2.artifact_path)) {
      console.log("✓ Artifact 文件已更新");
      const content = readFileSync(r2.artifact_path, "utf-8");
      console.log(`  文件大小: ${content.length} bytes`);
    } else {
      console.log("✗ Artifact 文件未更新");
    }
  } else {
    console.log("跳过 Test 2（没有已有 Artifact 可修改）");
  }

  console.log("\n=== 验证完成 ===");
}

main().catch(console.error);
