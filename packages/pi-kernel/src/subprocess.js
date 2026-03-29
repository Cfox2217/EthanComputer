/**
 * pi-kernel — 子进程管理
 *
 * 参考 CraftAgent packages/pi-agent-server/src/index.ts 的 main() 模式
 * 管理 pi-agent-server 子进程的启动、通信、关闭
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
/** 发送 JSONL 消息到子进程 */
function send(proc, msg) {
    proc.stdin?.write(JSON.stringify(msg) + "\n");
}
/** 等待子进程发送 ready 消息 */
function waitForReady(proc) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Pi subprocess ready timeout (30s)"));
        }, 30_000);
        const rl = createInterface({ input: proc.stdout });
        rl.on("line", (line) => {
            try {
                const msg = JSON.parse(line);
                if (msg.type === "ready") {
                    clearTimeout(timeout);
                    rl.close();
                    resolve();
                }
            }
            catch {
                // 忽略解析错误
            }
        });
    });
}
/**
 * 管理 Pi agent server 子进程
 *
 * 参考 CraftAgent 的 PiAgent class 模式：
 * - spawn 子进程
 * - JSONL stdin/stdout 通信
 * - 事件流订阅
 */
export class PiSubprocess {
    proc = null;
    eventHandlers = [];
    readline = null;
    async start(config) {
        const entry = resolve(config.serverEntry);
        this.proc = spawn("node", [entry], {
            cwd: config.cwd,
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env },
        });
        this.proc.stderr?.on("data", (data) => {
            const msg = data.toString().trim();
            if (msg)
                console.error(`[pi-kernel stderr] ${msg}`);
        });
        // 启动 readline 监听 stdout
        this.readline = createInterface({ input: this.proc.stdout });
        this.readline.on("line", (line) => {
            if (!line.trim())
                return;
            try {
                const msg = JSON.parse(line);
                for (const handler of this.eventHandlers) {
                    handler(msg);
                }
            }
            catch {
                // 忽略 JSON 解析错误
            }
        });
        // 发送 init
        this.sendInit({
            apiKey: config.apiKey,
            model: config.model,
            cwd: config.cwd,
        });
        // 等待 ready
        await waitForReady(this.proc);
    }
    sendInit(params) {
        if (!this.proc)
            throw new Error("Process not started");
        const msg = {
            type: "init",
            apiKey: params.apiKey,
            model: params.model,
            cwd: params.cwd,
            sessionId: `ethan-${Date.now()}`,
            sessionPath: params.cwd,
            thinkingLevel: "medium",
            workspaceRootPath: params.cwd,
        };
        send(this.proc, msg);
    }
    /** 发送 prompt 到子进程 */
    async prompt(message, systemPrompt) {
        if (!this.proc)
            throw new Error("Process not started");
        const msg = {
            type: "prompt",
            id: `prompt-${Date.now()}`,
            message,
            systemPrompt: systemPrompt ?? "",
        };
        send(this.proc, msg);
    }
    /** 订阅事件 */
    onEvent(handler) {
        this.eventHandlers.push(handler);
        return () => {
            const idx = this.eventHandlers.indexOf(handler);
            if (idx >= 0)
                this.eventHandlers.splice(idx, 1);
        };
    }
    /** 关闭子进程 */
    async stop() {
        if (!this.proc)
            return;
        send(this.proc, { type: "shutdown" });
        this.proc.kill("SIGTERM");
        this.proc = null;
        this.readline?.close();
        this.readline = null;
    }
}
//# sourceMappingURL=subprocess.js.map