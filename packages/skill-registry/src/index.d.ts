/**
 * skill-registry — 本地 Skill 读取
 *
 * 从 skills/local/ 目录扫描 SKILL.md 格式文件，
 * 解析 YAML frontmatter + Markdown body，映射为 Skill 类型。
 *
 * 标准 SKILL.md frontmatter 只有 name + description。
 * version/scenarios/constraints 从 metadata 或 body 中提取。
 */
import type { Skill } from "@ethan-computer/protocol-types";
export interface SkillRegistry {
    /** 列出所有可用 skill_id */
    list(): Promise<string[]>;
    /** 按 skill_id 加载 Skill */
    load(skillId: string): Promise<Skill>;
    /** 加载所有 Skill */
    loadAll(): Promise<Skill[]>;
}
export declare function createSkillRegistry(skillsDir: string): SkillRegistry;
//# sourceMappingURL=index.d.ts.map