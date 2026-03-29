/**
 * enter-runtime — L0 执行层
 *
 * MVP 主流程：
 * 1. 接收用户请求
 * 2. 加载所有 Artifact Headers → 注入 system prompt
 * 3. LLM 自己判断用哪个 Artifact 或升级
 * 4. 根据决策执行或构造 Upgrade
 * 5. 写入 RunRecord
 */
import type { Artifact, Upgrade, RunRecord } from "@ethan-computer/protocol-types";
import type { ArtifactRegistry } from "@ethan-computer/artifact-registry";
import type { PiKernel } from "@ethan-computer/pi-kernel";
interface ExecuteDecision {
    action: "execute";
    artifact_id: string;
    execution_plan: string;
}
interface EscalateDecision {
    action: "escalate";
    reason: string;
}
export interface EnterSuccess {
    type: "success";
    artifact: Artifact;
    decision: ExecuteDecision;
    record: RunRecord;
}
export interface EnterEscalate {
    type: "escalate";
    upgrade: Upgrade;
    decision: EscalateDecision;
    record: RunRecord;
}
export type EnterResult = EnterSuccess | EnterEscalate;
export interface EnterRuntimeConfig {
    user: string;
    runsDir: string;
    artifactRegistry: ArtifactRegistry;
    kernel: PiKernel;
}
export interface EnterRuntime {
    run(request: string): Promise<EnterResult>;
}
export declare function createEnterRuntime(config: EnterRuntimeConfig): EnterRuntime;
export {};
//# sourceMappingURL=index.d.ts.map