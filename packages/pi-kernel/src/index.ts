/**
 * pi-kernel — Pi 内核抽象层
 *
 * PiKernel 统一接口（start/prompt/stop + AsyncGenerator 事件流）。
 * prompt 支持单条消息（string）和多轮对话（ChatMessage[]）。
 * 当前使用 direct-llm 模式（直接调 Claude API）。
 * 后续接入 Pi subprocess 模式（@mariozechner/pi-coding-agent）。
 */

export type { AgentEvent, ChatMessage } from "./protocol.js";

import type { AgentEvent, ChatMessage } from "./protocol.js";

// ── PiKernel 统一接口 ────────────────────────────────────

export interface PiKernel {
  start(): Promise<void>;
  /** 单轮：传入字符串消息 */
  prompt(message: string, systemPrompt?: string): AsyncGenerator<AgentEvent>;
  /** 多轮：传入完整对话历史 */
  promptMessages(messages: ChatMessage[], systemPrompt?: string): AsyncGenerator<AgentEvent>;
  stop(): Promise<void>;
}

export interface PiKernelConfig {
  mode: "pi-subprocess" | "direct-llm";
  apiKey: string;
  model: string;
  baseUrl?: string;
  /** Pi subprocess 模式（后续启用） */
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

// ── Direct LLM 实现（MVP） ─────────────────────────────

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

    const response = await client.messages.create({
      model: this.config.model,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages: apiMessages,
    });

    const text = response.content
      .filter(
        (block): block is Extract<(typeof response.content)[number], { type: "text" }> =>
          block.type === "text",
      )
      .map((block) => block.text)
      .join("");

    yield { type: "text_delta", text };
    yield { type: "message_end", text };
    yield { type: "agent_end" };
  }

  async stop(): Promise<void> {}
}
