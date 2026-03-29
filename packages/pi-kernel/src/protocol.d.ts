/**
 * pi-kernel — JSONL 协议类型定义
 *
 * 参考 CraftAgent packages/pi-agent-server/src/index.ts
 * 精简版：只保留 MVP 需要的消息类型
 */
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
export type AgentEvent = TextDeltaEvent | MessageEndEvent | AgentEndEvent;
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
export type InboundMessage = InitMessage | PromptMessage | AbortMessage | ShutdownMessage;
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
export type OutboundMessage = ReadyMessage | EventMessage | ErrorMessage;
//# sourceMappingURL=protocol.d.ts.map