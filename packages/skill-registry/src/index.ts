/**
 * skill-registry — 本地 Skill 读取
 *
 * 从 skills/local/ 目录扫描 SKILL.md 格式文件，
 * 解析 YAML frontmatter + Markdown body，映射为 Skill 类型。
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { Skill } from "@ethan-computer/protocol-types";

/** 解析 SKILL.md 文件内容，返回 frontmatter 对象和 body */
function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error("Invalid SKILL.md format: missing frontmatter delimiters");
  }
  const data = yaml.load(match[1]) as Record<string, unknown>;
  const body = match[2];
  return { data, body };
}

/** 从 frontmatter + body 映射为 Skill 接口 */
function toSkill(data: Record<string, unknown>, body: string): Skill {
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

export interface SkillRegistry {
  /** 列出所有可用 skill_id */
  list(): Promise<string[]>;
  /** 按 skill_id 加载 Skill */
  load(skillId: string): Promise<Skill>;
  /** 加载所有 Skill */
  loadAll(): Promise<Skill[]>;
}

export function createSkillRegistry(skillsDir: string): SkillRegistry {
  return {
    async list() {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      const skillIds: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 检查目录下是否有 SKILL.md
          try {
            await readFile(join(skillsDir, entry.name, "SKILL.md"));
            skillIds.push(entry.name);
          } catch {
            // 无 SKILL.md，跳过
          }
        }
      }
      return skillIds;
    },

    async load(skillId: string) {
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
