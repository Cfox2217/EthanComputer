/**
 * pi-kernel — Pi 内核抽象层
 *
 * MVP 的 L0 执行内核。参考 CraftAgent 的双内核架构。
 * 当前使用 direct-llm 模式（直接调 Claude API）。
 * 后续接入 Pi subprocess 模式（@mariozechner/pi-coding-agent）。
 */
export function createPiKernel(config) {
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
class DirectLLMKernel {
    config;
    constructor(config) {
        this.config = config;
    }
    async start() { }
    async *prompt(message, systemPrompt) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({
            apiKey: this.config.apiKey,
            baseURL: this.config.baseUrl,
        });
        const response = await client.messages.create({
            model: this.config.model,
            max_tokens: 4096,
            system: systemPrompt || undefined,
            messages: [{ role: "user", content: message }],
        });
        const text = response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("");
        yield { type: "text_delta", text };
        yield { type: "message_end", text };
        yield { type: "agent_end" };
    }
    async stop() { }
}
//# sourceMappingURL=index.js.map