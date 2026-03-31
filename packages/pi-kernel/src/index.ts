/**
 * pi-kernel — Pi 内核抽象层
 *
 * PiKernel 统一接口。
 * - prompt / promptMessages: 纯文本 streaming（向后兼容）
 * - callWithTools: 支持 tool use 的结构化调用（agent loop 用）
 */

export type {
  AgentEvent,
  ChatMessage,
  ToolDef,
  ToolCall,
  LLMResponse,
  ContentBlock,
} from "./protocol.js";

import type {
  AgentEvent,
  ChatMessage,
  ToolDef,
  LLMResponse,
} from "./protocol.js";

// ── PiKernel 统一接口 ────────────────────────────────────

export interface PiKernel {
  start(): Promise<void>;
  /** 单轮：传入字符串消息（纯文本 streaming） */
  prompt(message: string, systemPrompt?: string): AsyncGenerator<AgentEvent>;
  /** 多轮：传入完整对话历史（纯文本 streaming） */
  promptMessages(messages: ChatMessage[], systemPrompt?: string): AsyncGenerator<AgentEvent>;
  /** 支持 tool use 的结构化调用（agent loop 用） */
  callWithTools(
    messages: ChatMessage[],
    systemPrompt: string,
    tools: ToolDef[],
    onText?: (text: string) => void,
  ): Promise<LLMResponse>;
  stop(): Promise<void>;
}

export interface PiKernelConfig {
  mode: "pi-subprocess" | "direct-llm";
  apiKey: string;
  model: string;
  baseUrl?: string;
  piServerEntry?: string;
  cwd?: string;
}

export function createPiKernel(config: PiKernelConfig): PiKernel {
  switch (config.mode) {
    case "direct-llm":
      return new DirectLLMKernel(config);
    case "pi-subprocess":
      throw new Error("Pi subprocess mode not yet implemented — use direct-llm for MVP");
    default:
      throw new Error(`Unknown kernel mode: ${config.mode}`);
  }
}

// ── Direct LLM 实现 ─────────────────────────────────────

class DirectLLMKernel implements PiKernel {
  private config: PiKernelConfig;

  constructor(config: PiKernelConfig) {
    this.config = config;
  }

  async start(): Promise<void> {}

  async *prompt(message: string, systemPrompt?: string): AsyncGenerator<AgentEvent> {
    const messages: ChatMessage[] = [{ role: "user", content: message }];
    yield* this.callLLM(messages, systemPrompt);
  }

  async *promptMessages(messages: ChatMessage[], systemPrompt?: string): AsyncGenerator<AgentEvent> {
    yield* this.callLLM(messages, systemPrompt);
  }

  private async *callLLM(messages: ChatMessage[], systemPrompt?: string): AsyncGenerator<AgentEvent> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });

    const apiMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let fullText = "";
    const stream = client.messages.stream({
      model: this.config.model,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        yield { type: "text_delta", text: fullText };
      }
    }

    yield { type: "message_end", text: fullText };
    yield { type: "agent_end" };
  }

  async callWithTools(
    messages: ChatMessage[],
    systemPrompt: string,
    tools: ToolDef[],
    onText?: (text: string) => void,
  ): Promise<LLMResponse> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });

    const apiMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let text = "";
    const toolCalls: { id: string; name: string; input: string }[] = [];
    let currentTool: { id: string; name: string; input: string } | null = null;

    const stream = client.messages.stream({
      model: this.config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: apiMessages,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          currentTool = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: "",
          };
        }
      }
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          text += event.delta.text;
          onText?.(text);
        }
        if (event.delta.type === "input_json_delta" && currentTool) {
          currentTool.input += event.delta.partial_json;
        }
      }
      if (event.type === "content_block_stop" && currentTool) {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(currentTool.input || "{}"); } catch { /* empty */ }
        toolCalls.push({
          id: currentTool.id,
          name: currentTool.name,
          input: parsed,
        });
        currentTool = null;
      }
    }

    return {
      text,
      toolCalls: toolCalls.map((tc) => ({ id: tc.id, name: tc.name, input: tc.input })),
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
    };
  }

  async stop(): Promise<void> {}
}
