/**
 * pi-kernel — Pi 内核抽象层
 *
 * MVP 的 L0 执行内核。参考 CraftAgent 的双内核架构。
 * 当前使用 direct-llm 模式（直接调 Claude API）。
 * 后续接入 Pi subprocess 模式（@mariozechner/pi-coding-agent）。
 */
export type { AgentEvent } from "./protocol.js";
import type { AgentEvent } from "./protocol.js";
export interface PiKernel {
    start(): Promise<void>;
    prompt(message: string, systemPrompt?: string): AsyncGenerator<AgentEvent>;
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
export declare function createPiKernel(config: PiKernelConfig): PiKernel;
//# sourceMappingURL=index.d.ts.map