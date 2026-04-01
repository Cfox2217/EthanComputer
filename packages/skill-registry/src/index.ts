/**
 * skill-registry — 本地 Skill 读取
 *
 * 从 Workspace/<user>/skills/ 目录扫描 SKILL.md 格式文件，
 * 解析 YAML frontmatter + Markdown body，映射为 Skill 类型。
 *
 * 接收 workspaceDir（如 "Workspace"），内部按 user 定位：
 *   workspaceDir/<user>/skills/<skillId>/SKILL.md
 *
 * 标准 SKILL.md frontmatter 只有 name + description。
 * version/scenarios/constraints 从 metadata 或 body 中提取。
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

/** 从 body 中提取指定 ## 段落下的列表项 */
function extractListSection(body: string, heading: string): string[] {
  const lines = body.split("\n");
  const items: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      inSection = line.includes(heading);
      continue;
    }
    if (inSection) {
      const match = line.match(/^[-*]\s+(.+)$/);
      if (match) {
        // 去掉 bold 标记：**key**: value → key: value
        const cleaned = match[1]
          .replace(/\*\*/g, "")
          .trim();
        items.push(cleaned);
      }
    }
  }
  return items;
}

/** 从 frontmatter + body 映射为 Skill 接口 */
function toSkill(data: Record<string, unknown>, body: string): Skill {
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : String(data.name ?? "");

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  return {
    skill_id: String(data.name ?? ""),
    version: String(metadata.version ?? data.version ?? "0.0.0"),
    title,
    description: String(data.description ?? ""),
    scenarios: extractListSection(body, "Scenarios"),
    constraints: extractListSection(body, "Constraints"),
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

export function createSkillRegistry(workspaceDir: string, user: string): SkillRegistry {
  const skillsDir = join(workspaceDir, user, "skills");
  return {
    async list() {
      const entries = await readdir(skillsDir, { withFileTypes: true });
      const skillIds: string[] = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
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
