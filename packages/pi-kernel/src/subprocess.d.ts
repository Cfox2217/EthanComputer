/**
 * pi-kernel — 子进程管理
 *
 * 参考 CraftAgent packages/pi-agent-server/src/index.ts 的 main() 模式
 * 管理 pi-agent-server 子进程的启动、通信、关闭
 */
import type { OutboundMessage } from "./protocol.js";
export interface PiSubprocessConfig {
    /** pi-agent-server 入口文件路径 */
    serverEntry: string;
    /** 工作目录 */
    cwd: string;
    /** API Key */
    apiKey: string;
    /** 模型名 */
    model: string;
}
/**
 * 管理 Pi agent server 子进程
 *
 * 参考 CraftAgent 的 PiAgent class 模式：
 * - spawn 子进程
 * - JSONL stdin/stdout 通信
 * - 事件流订阅
 */
export declare class PiSubprocess {
    private proc;
    private eventHandlers;
    private readline;
    start(config: PiSubprocessConfig): Promise<void>;
    private sendInit;
    /** 发送 prompt 到子进程 */
    prompt(message: string, systemPrompt?: string): Promise<void>;
    /** 订阅事件 */
    onEvent(handler: (event: OutboundMessage) => void): () => void;
    /** 关闭子进程 */
    stop(): Promise<void>;
}
//# sourceMappingURL=subprocess.d.ts.map