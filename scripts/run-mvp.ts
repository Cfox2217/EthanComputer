/**
 * run-mvp.ts — Ethan Debug Console 启动脚本
 *
 * 组装 TUI + enter-runtime + craft-engine + pi-kernel，
 * 提供 Debug Console 实时观察界面。
 *
 * 配置来源（优先级从高到低）：
 * 1. 环境变量 ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / ANTHROPIC_MODEL
 * 2. 项目根目录 .env.local 文件
 *
 * 运行: npx tsx scripts/run-mvp.ts
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { createSkillRegistry } from "@ethan-computer/skill-registry";
import { createArtifactRegistry } from "@ethan-computer/artifact-registry";
import { createPiKernel, type ChatMessage } from "@ethan-computer/pi-kernel";
import { createCraftEngine } from "@ethan-computer/craft-engine";
import { createEnterRuntime } from "@ethan-computer/enter-runtime";
import { startTui } from "@ethan-computer/tui";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── 配置加载 ────────────────────────────────────────────

interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function loadConfig(): Config {
  const envPath = join(ROOT, ".env.local");
  const fileEnv: Record<string, string> = {};
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        fileEnv[key] = val;
      }
    }
  }

  return {
    apiKey: process.env.ANTHROPIC_API_KEY ?? fileEnv.ANTHROPIC_API_KEY ?? "",
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? fileEnv.ANTHROPIC_BASE_URL ?? "https://open.bigmodel.cn/api/anthropic",
    model: process.env.ANTHROPIC_MODEL ?? fileEnv.ANTHROPIC_MODEL ?? "glm-5.1",
  };
}

async function main() {
  const config = loadConfig();

  if (!config.apiKey) {
    console.error("ERROR: API Key 未配置。请设置环境变量 ANTHROPIC_API_KEY 或在 .env.local 中配置");
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
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
  });

  // ── 启动 TUI ──────────────────────────────────────────
  let conversationMessages: ChatMessage[] = [];

  const { emit, waitUntilExit } = startTui({
    onRun: async (request: string) => {
      const craftEngine = createCraftEngine({
        skillRegistry,
        artifactRegistry,
        artifactsDir: join(ROOT, "artifacts"),
        user: "ethan",
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        maxIterations: 10,
        onEvent: emit,
      });

      const runtime = createEnterRuntime({
        user: "ethan",
        runsDir: join(ROOT, "runs"),
        sessionsDir,
        artifactRegistry,
        kernel,
        craftEngine,
        maxEscalations: 1,
        onEvent: emit,
      });

      const result = await runtime.run(request, conversationMessages);
      conversationMessages = result.messages;
    },
  });

  await waitUntilExit;
}

main().catch(console.error);
