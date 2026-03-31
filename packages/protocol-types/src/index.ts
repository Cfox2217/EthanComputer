/**
 * Ethan Computer — 最小协议类型
 *
 * 严格按 SPEC §15 定义，只做 interface，不做类、不做验证、不做工具函数。
 */

// ── Skill（§15.1）──────────────────────────────────────────

export interface Skill {
  skill_id: string;
  version: string;
  title: string;
  description: string;
  scenarios: string[];
  constraints: string[];
}

// ── Artifact（§15.2）───────────────────────────────────────

export interface ArtifactHeader {
  title: string;
  when_to_use: string[];
  derived_from: string;
  escalate_when: string[];
}

export interface ArtifactBody {
  user_facts: Record<string, unknown>;
  execution: string[];
  escalate_when: string[];
}

export interface Artifact {
  artifact_id: string;
  header: ArtifactHeader;
  body: ArtifactBody;
}

// ── Upgrade（§15.3）────────────────────────────────────────

export interface Upgrade {
  request: string;
  current_artifact: string | null;
  why_not_enough: string;
  known_facts: Record<string, unknown>;
}

// ── CraftResult（§15.4）────────────────────────────────────

export interface CraftResult {
  skill_used: string;
  new_artifact: string;
  summary: string[];
  resume_hint: string;
}

// ── RunRecord（§15.5）──────────────────────────────────────

export interface RunRecord {
  run_id: string;
  request: string;
  used_artifact: string | null;
  escalated: boolean;
  craft_applied: boolean;
  result: "success" | "failure" | "partial";
}

// ── TUI Event（用于 runtime → TUI 实时事件）──────────────────

export type TuiEvent =
  | { type: "request"; text: string; runId: string }
  | { type: "headers_loaded"; count: number }
  | { type: "l0_streaming"; text: string }
  | { type: "l0_decision"; action: "execute" | "escalate"; artifact_id?: string; reason?: string }
  | { type: "l1_start"; skill: string }
  | { type: "l1_tool_call"; round: number; tool: string; summary: string; ms: number }
  | { type: "l1_report"; summary: string }
  | { type: "l0_resume"; headersCount: number }
  | { type: "l0_reply"; text: string }
  | { type: "result"; outcome: string; totalMs: number };
