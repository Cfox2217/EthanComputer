/**
 * 验证 Step 2: Skill/Artifact 读取
 *
 * 运行: npx tsx scripts/verify-step2.ts
 */
import { join } from "node:path";
import { createSkillRegistry } from "@ethan-computer/skill-registry";
import { createArtifactRegistry } from "@ethan-computer/artifact-registry";
const ROOT = join(__dirname, "..");
async function main() {
    // --- Skill Registry ---
    console.log("=== Skill Registry ===\n");
    const skills = createSkillRegistry(join(ROOT, "skills", "local"));
    const skillIds = await skills.list();
    console.log("Skill IDs:", skillIds);
    for (const id of skillIds) {
        const skill = await skills.load(id);
        console.log(`\n[${skill.skill_id}]`);
        console.log(`  title: ${skill.title}`);
        console.log(`  version: ${skill.version}`);
        console.log(`  description: ${skill.description}`);
        console.log(`  scenarios: ${skill.scenarios.join(", ")}`);
        console.log(`  constraints: ${skill.constraints.join(", ")}`);
    }
    // --- Artifact Registry ---
    console.log("\n=== Artifact Registry ===\n");
    const artifacts = createArtifactRegistry(join(ROOT, "artifacts"));
    const headers = await artifacts.listHeaders("ethan");
    console.log("Artifact headers:");
    for (const h of headers) {
        console.log(`  [${h.artifact_id}] ${h.header.title}`);
        console.log(`    when_to_use: ${h.header.when_to_use.join(", ")}`);
        console.log(`    derived_from: ${h.header.derived_from}`);
    }
    if (headers.length > 0) {
        const full = await artifacts.load("ethan", headers[0].artifact_id);
        console.log(`\nFull artifact [${full.artifact_id}]:`);
        console.log(`  user_facts:`, full.body.user_facts);
        console.log(`  execution: ${full.body.execution.join(" → ")}`);
        console.log(`  escalate_when: ${full.body.escalate_when.join(", ")}`);
    }
}
main().catch(console.error);
//# sourceMappingURL=verify-step2.js.map