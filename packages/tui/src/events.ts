/**
 * TUI 事件状态管理
 *
 * 核心原则：所有 streaming 文本在清空前必须先保存到 reasoning steps，
 * 确保 agent 的完整决策过程始终可见。
 */

import type { TuiEvent } from "@ethan-computer/protocol-types";

export type Phase = "idle" | "l0-thinking" | "l1-craft" | "l0-resume" | "done";

export interface ToolCallRecord {
  round?: number;
  tool: string;
  summary: string;
  ms: number;
}

export interface ReasoningStep {
  round: number;
  text: string;
}

export interface RunState {
  phase: Phase;
  runId: string;
  request: string;
  headersCount: number;
  /** L0 agent 推理步骤（每轮迭代的完整输出，累积不丢失） */
  l0ReasoningSteps: ReasoningStep[];
  /** L0 当前轮次的实时流式文本 */
  streamingText: string;
  /** L0 tool calls（load_artifact, escalate） */
  l0ToolCalls: ToolCallRecord[];
  /** L1 信息 */
  l1Skill: string | null;
  /** L1 agent 推理步骤（每轮迭代的完整输出，累积不丢失） */
  l1ReasoningSteps: ReasoningStep[];
  /** L1 当前轮次的实时流式文本 */
  l1StreamingText: string;
  l1ToolCalls: ToolCallRecord[];
  l1ReportSummary: string | null;
  /** L1 craft 成果 */
  craftResult: {
    artifact_path: string;
    summary: string;
    continue_hint: string;
  } | null;
  /** 恢复阶段 */
  resumeHeadersCount: number | null;
  /** L0 恢复阶段实时流式文本 */
  l0ResumeStreamingText: string;
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
    l0ReasoningSteps: [],
    streamingText: "",
    l0ToolCalls: [],
    l1Skill: null,
    l1ReasoningSteps: [],
    l1StreamingText: "",
    l1ToolCalls: [],
    l1ReportSummary: null,
    craftResult: null,
    resumeHeadersCount: null,
    l0ResumeStreamingText: "",
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

/** 将 streaming 文本保存为 reasoning step（去重：同 round 不重复添加） */
function saveReasoningStep(
  steps: ReasoningStep[],
  round: number,
  text: string,
): ReasoningStep[] {
  if (!text) return steps;
  // 如果 l0_agent_reasoning 已经为这个 round 添加过，跳过
  if (steps.some(s => s.round === round)) return steps;
  return [...steps, { round, text }];
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

    case "l0_thinking":
      // GLM-5.1 不产生 thinking_delta，此事件暂时无用
      return state;

    case "l0_streaming":
      // resume 阶段的 streaming 路由到专用字段
      if (state.phase === "l0-resume") {
        return { ...state, l0ResumeStreamingText: event.text };
      }
      return { ...state, streamingText: event.text };

    case "l0_decision":
      // 不清理 streamingText —— 由 l0_tool_call 负责保存后清理
      return state;

    case "l0_agent_reasoning":
      return {
        ...state,
        l0ReasoningSteps: [...state.l0ReasoningSteps, { round: event.round, text: event.text }],
      };

    case "l0_tool_call": {
      // 保存当前轮次的 streaming 文本到 reasoning steps
      const currentText = state.phase === "l0-resume"
        ? state.l0ResumeStreamingText
        : state.streamingText;
      const newSteps = saveReasoningStep(state.l0ReasoningSteps, event.round, currentText);

      if (state.phase === "l0-resume") {
        return {
          ...state,
          l0ReasoningSteps: newSteps,
          l0ToolCalls: [...state.l0ToolCalls, {
            round: event.round,
            tool: event.tool,
            summary: event.summary,
            ms: event.ms,
          }],
          firstToolCallAt: state.firstToolCallAt ?? now,
          l0ResumeStreamingText: "",
        };
      }
      return {
        ...state,
        l0ReasoningSteps: newSteps,
        l0ToolCalls: [...state.l0ToolCalls, {
          round: event.round,
          tool: event.tool,
          summary: event.summary,
          ms: event.ms,
        }],
        firstToolCallAt: state.firstToolCallAt ?? now,
        streamingText: "",
      };
    }

    case "l0_reply":
      return {
        ...state,
        l0Reply: event.text,
        l0ReplyAt: now,
        streamingText: "",
        l0ResumeStreamingText: "",
      };

    case "l1_start":
      return {
        ...state,
        phase: "l1-craft",
        l1Skill: event.skill,
        l1StartAt: now,
        streamingText: "",
      };

    case "l1_thinking":
      // GLM-5.1 不产生 thinking_delta
      return state;

    case "l1_streaming":
      return { ...state, l1StreamingText: event.text };

    case "l1_tool_call": {
      // 保存当前轮次的 streaming 文本到 reasoning steps
      const newL1Steps = saveReasoningStep(state.l1ReasoningSteps, event.round, state.l1StreamingText);
      return {
        ...state,
        l1ReasoningSteps: newL1Steps,
        l1ToolCalls: [...state.l1ToolCalls, {
          round: event.round,
          tool: event.tool,
          summary: event.summary,
          ms: event.ms,
        }],
        l1StreamingText: "",
      };
    }

    case "l1_report": {
      // 保存最后的 streaming 文本（craft report）
      const lastRound = state.l1ToolCalls.length > 0
        ? Math.max(...state.l1ToolCalls.map(tc => tc.round || 0)) + 1
        : 1;
      const newL1Steps = saveReasoningStep(state.l1ReasoningSteps, lastRound, state.l1StreamingText);
      return {
        ...state,
        l1ReasoningSteps: newL1Steps,
        l1ReportSummary: event.summary,
        l1EndAt: now,
        l1StreamingText: "",
      };
    }

    case "l1_craft_result":
      return { ...state, craftResult: event };

    case "l0_resume":
      return {
        ...state,
        phase: "l0-resume",
        resumeHeadersCount: event.headersCount,
        l0ResumeAt: now,
        l1StreamingText: "",
        l0ResumeStreamingText: "",
      };

    case "result": {
      // partial outcome 时兜底保存残留的流式文本
      let newSteps = state.l0ReasoningSteps;
      if (!state.l0Reply) {
        const currentText = state.phase === "l0-resume"
          ? state.l0ResumeStreamingText
          : state.streamingText;
        if (currentText) {
          const lastToolRound = state.l0ToolCalls.length > 0
            ? Math.max(...state.l0ToolCalls.map(tc => tc.round || 0))
            : 0;
          const lastStepRound = state.l0ReasoningSteps.length > 0
            ? Math.max(...state.l0ReasoningSteps.map(s => s.round))
            : 0;
          const nextRound = Math.max(lastToolRound, lastStepRound) + 1;
          newSteps = [...state.l0ReasoningSteps, { round: nextRound, text: currentText }];
        }
      }
      return {
        ...state,
        l0ReasoningSteps: newSteps,
        phase: "done",
        outcome: event.outcome,
        totalMs: event.totalMs,
        streamingText: "",
        l0ResumeStreamingText: "",
      };
    }

    default:
      return state;
  }
}
