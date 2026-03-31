/**
 * verify-tui.ts — 非交互式事件链路冒烟测试
 *
 * 验证 streaming + 事件发射链路完整：
 * pi-kernel streaming → enter-runtime onEvent → craft-engine onEvent → TUI state
 *
 * 运行: npx tsx scripts/verify-tui.ts
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { createSkillRegistry } from "@ethan-computer/skill-registry";
import { createArtifactRegistry } from "@ethan-computer/artifact-registry";
import { createPiKernel } from "@ethan-computer/pi-kernel";
import { createCraftEngine } from "@ethan-computer/craft-engine";
import { createEnterRuntime } from "@ethan-computer/enter-runtime";
import { applyEvent, initialRunState } from "../packages/tui/src/events.ts";
import type { TuiEvent } from "@ethan-computer/protocol-types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// 从 .env.local 加载配置（与环境变量合并）
function loadApiKey(): string {
  const envPath = join(ROOT, ".env.local");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^ANTHROPIC_API_KEY\s*=\s*(.+)$/);
      if (m) return m[1].trim();
    }
  }
  return process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN ?? "";
}

const API_KEY = loadApiKey();
const BASE_URL = "https://open.bigmodel.cn/api/anthropic";
const MODEL = "glm-5.1";

async function main() {
  if (!API_KEY) {
    console.error("ERROR: API Key 未配置（.env.local 或 ANTHROPIC_API_KEY 环境变量）");
    process.exit(1);
  }

  const sessionsDir = join(ROOT, "runs", "sessions");
  mkdirSync(sessionsDir, { recursive: true });

  const skillRegistry = createSkillRegistry(join(ROOT, "skills", "local"));
  const artifactRegistry = createArtifactRegistry(join(ROOT, "artifacts"));

  // ── 收集事件 ────────────────────────────────────────
  const events: TuiEvent[] = [];
  const recordEvent = (e: TuiEvent) => {
    events.push(e);
    switch (e.type) {
      case "request":
        console.log(`  [request] "${e.text.slice(0, 50)}"`);
        break;
      case "headers_loaded":
        console.log(`  [headers_loaded] count=${e.count}`);
        break;
      case "l0_streaming":
        process.stdout.write(".");
        break;
      case "l0_decision":
        console.log(`\n  [l0_decision] ${e.action}${e.reason ? ` · ${e.reason.slice(0, 50)}` : ""}${e.artifact_id ? ` → ${e.artifact_id}` : ""}`);
        break;
      case "l1_start":
        console.log(`  [l1_start] skill=${e.skill}`);
        break;
      case "l1_tool_call":
        console.log(`  [l1_tool_call] [${e.round}] ${e.tool} ${e.summary} ${e.ms}ms`);
        break;
      case "l1_report":
        console.log(`  [l1_report] ${e.summary}`);
        break;
      case "l0_resume":
        console.log(`  [l0_resume] headers=${e.headersCount}`);
        break;
      case "l0_reply":
        console.log(`  [l0_reply] "${e.text.slice(0, 80)}"`);
        break;
      case "result":
        console.log(`  [result] ${e.outcome} ${e.totalMs}ms`);
        break;
    }
  };

  // ── 构建各层 ────────────────────────────────────────
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
    onEvent: recordEvent,
  });

  const runtime = createEnterRuntime({
    user: "ethan",
    runsDir: join(ROOT, "runs"),
    sessionsDir,
    artifactRegistry,
    kernel,
    craftEngine,
    maxEscalations: 1,
    onEvent: recordEvent,
  });

  // ── 运行 ────────────────────────────────────────────
  const request = "帮我监控本地磁盘使用率，超过 85% 时自动报警";
  console.log(`\n=== TUI Event Chain Test ===\n`);
  console.log(`Request: "${request}"\n`);

  const t0 = Date.now();
  const result = await runtime.run(request);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n--- Done (${elapsed}s) ---\n`);

  // ── 验证事件完整性 ──────────────────────────────────
  const types = events.map(e => e.type);
  const uniqueTypes = [...new Set(types)];

  console.log(`Events: ${events.length} total, types: [${uniqueTypes.join(", ")}]`);
  console.log(`Result: ${result.type}, escalated=${result.record.escalated}, craft=${result.record.craft_applied}`);

  const checks: [string, boolean][] = [
    ["has request", types.includes("request")],
    ["has headers_loaded", types.includes("headers_loaded")],
    ["has l0_decision", types.includes("l0_decision")],
    ["has result", types.includes("result")],
  ];

  if (result.record.escalated) {
    checks.push(
      ["has l1_start", types.includes("l1_start")],
      ["has l1_tool_call", types.includes("l1_tool_call")],
      ["has l1_report", types.includes("l1_report")],
    );
  }
  if (result.record.craft_applied) {
    checks.push(["has l0_resume", types.includes("l0_resume")]);
  }

  // ── 验证 TUI state 能正确消费所有事件 ────────────────
  let state = initialRunState();
  for (const e of events) {
    state = applyEvent(state, e);
  }
  checks.push(["state.phase=done", state.phase === "done"]);
  checks.push(["state.outcome set", state.outcome !== null]);

  console.log(`\nChecks:`);
  let allPass = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? "✓" : "✗"} ${label}`);
    if (!pass) allPass = false;
  }

  if (allPass) {
    console.log(`\n=== All checks passed ===`);
  } else {
    console.error(`\n=== Some checks FAILED ===`);
    process.exit(1);
  }
}

main().catch(console.error);
