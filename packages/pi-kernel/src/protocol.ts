/**
 * pi-kernel — JSONL 协议类型定义
 *
 * 参考 CraftAgent packages/pi-agent-server/src/index.ts
 * 精简版：只保留 MVP 需要的消息类型
 */

// ── Agent 事件类型 ──────────────────────────────────────────

export interface ThinkingDeltaEvent {
  type: "thinking_delta";
  text: string;
}

export interface TextDeltaEvent {
  type: "text_delta";
  text: string;
}

export interface MessageEndEvent {
  type: "message_end";
  text: string;
}

export interface AgentEndEvent {
  type: "agent_end";
}

export type AgentEvent =
  | ThinkingDeltaEvent
  | TextDeltaEvent
  | MessageEndEvent
  | AgentEndEvent;

// ── Tool Use 类型 ────────────────────────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCall[];
  /** end_turn = 纯文本回复完成；tool_use = 需要 tool 执行 */
  stopReason: "end_turn" | "tool_use" | string;
}

// ── 对话消息类型 ────────────────────────────────────────────

export interface TextContent {
  type: "text";
  text: string;
}

export interface ToolUseContent {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

// ── Pi subprocess 协议（后续启用） ──────────────────────────

export interface InitMessage {
  type: "init";
  apiKey: string;
  model: string;
  cwd: string;
  sessionId: string;
  sessionPath: string;
  thinkingLevel?: string;
  workspaceRootPath?: string;
}

export interface PromptMessage {
  type: "prompt";
  id: string;
  message: string;
  systemPrompt: string;
}

export interface AbortMessage {
  type: "abort";
}

export interface ShutdownMessage {
  type: "shutdown";
}

export type InboundMessage =
  | InitMessage
  | PromptMessage
  | AbortMessage
  | ShutdownMessage;

export interface ReadyMessage {
  type: "ready";
  sessionId: string | null;
}

export interface EventMessage {
  type: "event";
  event: AgentEvent;
}

export interface ErrorMessage {
  type: "error";
  message: string;
  code?: string;
}

export type OutboundMessage =
  | ReadyMessage
  | EventMessage
  | ErrorMessage;
