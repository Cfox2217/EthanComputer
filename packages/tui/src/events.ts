/**
 * TUI 事件状态管理
 *
 * 将 TuiEvent 流转化为结构化的 UI 状态
 */

import type { TuiEvent } from "@ethan-computer/protocol-types";

export type Phase = "idle" | "l0-decision" | "l1-craft" | "l0-resume" | "done";

export interface ToolCallRecord {
  round: number;
  tool: string;
  summary: string;
  ms: number;
}

export interface RunState {
  phase: Phase;
  runId: string;
  request: string;
  headersCount: number;
  /** 当前 LLM streaming 文本 */
  streamingText: string;
  /** L0 决策 */
  l0Action: "execute" | "escalate" | null;
  l0ArtifactId: string | null;
  l0Reason: string | null;
  /** L1 信息 */
  l1Skill: string | null;
  l1ToolCalls: ToolCallRecord[];
  l1ReportSummary: string | null;
  /** 恢复阶段 */
  resumeHeadersCount: number | null;
  /** L0 最终回复 */
  l0Reply: string | null;
  /** 最终结果 */
  outcome: string | null;
  totalMs: number;
  startTime: number;
}

export function initialRunState(): RunState {
  return {
    phase: "idle",
    runId: "",
    request: "",
    headersCount: 0,
    streamingText: "",
    l0Action: null,
    l0ArtifactId: null,
    l0Reason: null,
    l1Skill: null,
    l1ToolCalls: [],
    l1ReportSummary: null,
    resumeHeadersCount: null,
    l0Reply: null,
    outcome: null,
    totalMs: 0,
    startTime: 0,
  };
}

/** 将 TuiEvent 应用到 RunState */
export function applyEvent(state: RunState, event: TuiEvent): RunState {
  switch (event.type) {
    case "request":
      return {
        ...initialRunState(),
        phase: "l0-decision",
        runId: event.runId,
        request: event.text,
        startTime: Date.now(),
      };
    case "headers_loaded":
      return { ...state, headersCount: event.count };
    case "l0_streaming":
      return { ...state, streamingText: event.text };
    case "l0_decision":
      return {
        ...state,
        l0Action: event.action,
        l0ArtifactId: event.artifact_id ?? null,
        l0Reason: event.reason ?? null,
        streamingText: "",
      };
    case "l1_start":
      return { ...state, phase: "l1-craft", l1Skill: event.skill };
    case "l1_tool_call":
      return {
        ...state,
        l1ToolCalls: [...state.l1ToolCalls, {
          round: event.round,
          tool: event.tool,
          summary: event.summary,
          ms: event.ms,
        }],
      };
    case "l1_report":
      return { ...state, l1ReportSummary: event.summary };
    case "l0_resume":
      return {
        ...state,
        phase: "l0-resume",
        resumeHeadersCount: event.headersCount,
        streamingText: "",
      };
    case "l0_reply":
      return { ...state, l0Reply: event.text };
    case "result":
      return {
        ...state,
        phase: "done",
        outcome: event.outcome,
        totalMs: event.totalMs,
      };
    default:
      return state;
  }
}
