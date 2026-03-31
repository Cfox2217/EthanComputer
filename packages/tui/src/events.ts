/**
 * TUI 事件状态管理
 *
 * 将 TuiEvent 流转化为结构化的 UI 状态
 * L0 现在是 agent loop，事件流：request → headers → streaming/tool_call → reply → result
 */

import type { TuiEvent } from "@ethan-computer/protocol-types";

export type Phase = "idle" | "l0-thinking" | "l1-craft" | "l0-resume" | "done";

export interface ToolCallRecord {
  round?: number;
  tool: string;
  summary: string;
  ms: number;
}

export interface RunState {
  phase: Phase;
  runId: string;
  request: string;
  headersCount: number;
  /** L0 agent streaming 文本 */
  streamingText: string;
  /** L0 tool calls（load_artifact, escalate） */
  l0ToolCalls: ToolCallRecord[];
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
  // 时间戳
  firstToolCallAt: number | null;
  l1StartAt: number | null;
  l1EndAt: number | null;
  l0ResumeAt: number | null;
  l0ReplyAt: number | null;
}

export function initialRunState(): RunState {
  return {
    phase: "idle",
    runId: "",
    request: "",
    headersCount: 0,
    streamingText: "",
    l0ToolCalls: [],
    l1Skill: null,
    l1ToolCalls: [],
    l1ReportSummary: null,
    resumeHeadersCount: null,
    l0Reply: null,
    outcome: null,
    totalMs: 0,
    startTime: 0,
    firstToolCallAt: null,
    l1StartAt: null,
    l1EndAt: null,
    l0ResumeAt: null,
    l0ReplyAt: null,
  };
}

/** 将 TuiEvent 应用到 RunState */
export function applyEvent(state: RunState, event: TuiEvent): RunState {
  const now = Date.now();

  switch (event.type) {
    case "request":
      return {
        ...initialRunState(),
        phase: "l0-thinking",
        runId: event.runId,
        request: event.text,
        startTime: now,
      };

    case "headers_loaded":
      return { ...state, headersCount: event.count };

    case "l0_streaming":
      return { ...state, streamingText: event.text };

    case "l0_decision":
      // escalate: L0 决定升级 → L1 即将启动
      if (event.action === "escalate") {
        return { ...state, streamingText: "" };
      }
      return state;

    case "l0_tool_call":
      return {
        ...state,
        l0ToolCalls: [...state.l0ToolCalls, {
          tool: event.tool,
          summary: event.summary,
          ms: event.ms,
        }],
        firstToolCallAt: state.firstToolCallAt ?? now,
        streamingText: "",
      };

    case "l0_reply":
      return { ...state, l0Reply: event.text, l0ReplyAt: now, streamingText: "" };

    case "l1_start":
      return { ...state, phase: "l1-craft", l1Skill: event.skill, l1StartAt: now, streamingText: "" };

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
      return { ...state, l1ReportSummary: event.summary, l1EndAt: now };

    case "l0_resume":
      return {
        ...state,
        phase: "l0-resume",
        resumeHeadersCount: event.headersCount,
        l0ResumeAt: now,
        streamingText: "",
      };

    case "result":
      return {
        ...state,
        phase: "done",
        outcome: event.outcome,
        totalMs: event.totalMs,
        streamingText: "",
      };

    default:
      return state;
  }
}
