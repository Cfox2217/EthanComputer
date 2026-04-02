/**
 * Ethan Computer — 最小协议类型
 *
 * 严格按 SPEC §15 定义，只做 interface，不做类、不做验证、不做工具函数。
 */
export interface Skill {
    skill_id: string;
    version: string;
    title: string;
    description: string;
    scenarios: string[];
    constraints: string[];
}
export interface ArtifactHeader {
    title: string;
    when_to_use: string[];
    derived_from: string;
    escalate_when: string[];
    required_capabilities?: string[];
}
export interface ArtifactBody {
    user_facts: Record<string, unknown>;
    execution: string[];
    capabilities: string[];
    escalate_when: string[];
}
export interface Artifact {
    artifact_id: string;
    header: ArtifactHeader;
    body: ArtifactBody;
}
export interface Upgrade {
    request: string;
    current_artifact: string | null;
    why_not_enough: string;
    known_facts: Record<string, unknown>;
}
export interface CraftResult {
    skill_used: string;
    new_artifact: string;
    summary: string[];
    resume_hint: string;
}
export interface RunRecord {
    run_id: string;
    request: string;
    used_artifact: string | null;
    escalated: boolean;
    craft_applied: boolean;
    result: "success" | "failure" | "partial";
}
//# sourceMappingURL=index.d.ts.map