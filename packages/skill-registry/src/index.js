/**
 * skill-registry — 本地 Skill 读取
 *
 * 从 skills/local/ 目录扫描 SKILL.md 格式文件，
 * 解析 YAML frontmatter + Markdown body，映射为 Skill 类型。
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
/** 解析 SKILL.md 文件内容，返回 frontmatter 对象和 body */
function parseFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
        throw new Error("Invalid SKILL.md format: missing frontmatter delimiters");
    }
    const data = yaml.load(match[1]);
    const body = match[2];
    return { data, body };
}
/** 从 frontmatter + body 映射为 Skill 接口 */
function toSkill(data, body) {
    // 从 markdown body 提取第一个 # 标题作为 title
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : String(data.name ?? "");
    return {
        skill_id: String(data.name ?? ""),
        version: String(data.version ?? "0.0.0"),
        title,
        description: String(data.description ?? ""),
        scenarios: Array.isArray(data.scenarios)
            ? data.scenarios.map(String)
            : [],
        constraints: Array.isArray(data.constraints)
            ? data.constraints.map(String)
            : [],
    };
}
export function createSkillRegistry(skillsDir) {
    return {
        async list() {
            const entries = await readdir(skillsDir, { withFileTypes: true });
            const skillIds = [];
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // 检查目录下是否有 SKILL.md
                    try {
                        await readFile(join(skillsDir, entry.name, "SKILL.md"));
                        skillIds.push(entry.name);
                    }
                    catch {
                        // 无 SKILL.md，跳过
                    }
                }
            }
            return skillIds;
        },
        async load(skillId) {
            const filePath = join(skillsDir, skillId, "SKILL.md");
            const raw = await readFile(filePath, "utf-8");
            const { data, body } = parseFrontmatter(raw);
            return toSkill(data, body);
        },
        async loadAll() {
            const ids = await this.list();
            return Promise.all(ids.map((id) => this.load(id)));
        },
    };
}
//# sourceMappingURL=index.js.map