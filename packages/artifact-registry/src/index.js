/**
 * artifact-registry — 本地 Artifact 读取与保存
 *
 * 从 artifacts/<user>/ 目录扫描 .md 文件，
 * 解析 YAML frontmatter + Markdown body，映射为 Artifact 类型。
 *
 * MVP 支持三层操作：
 * 1. listHeaders — 加载所有 Artifact Header（供 L0 快速判断）
 * 2. load — 加载完整 Artifact（Header + Body）
 * 3. save — 写入新 Artifact
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
/** 解析 frontmatter 格式文件 */
function parseFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
        throw new Error("Invalid artifact format: missing frontmatter delimiters");
    }
    const data = yaml.load(match[1]);
    const body = match[2];
    return { data, body };
}
/** 从 frontmatter 映射为 ArtifactHeader */
function toHeader(data, body) {
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : String(data.name ?? "");
    return {
        title,
        when_to_use: extractListSection(body, "When to use"),
        derived_from: String(data.derived_from ?? ""),
        escalate_when: extractListSection(body, "Escalate when"),
    };
}
/** 从 body 中提取指定 ## 段落下的列表项 */
function extractListSection(body, heading) {
    const lines = body.split("\n");
    const items = [];
    let inSection = false;
    for (const line of lines) {
        if (line.startsWith("## ")) {
            if (line.includes(heading)) {
                inSection = true;
            }
            else {
                inSection = false;
            }
            continue;
        }
        if (inSection) {
            const match = line.match(/^[-*]\s+(.+)$/);
            if (match) {
                items.push(match[1].trim());
            }
        }
    }
    return items;
}
/** 从 body 中提取 Execution 段落的有序步骤 */
function extractExecutionSteps(body) {
    const lines = body.split("\n");
    const steps = [];
    let inSection = false;
    for (const line of lines) {
        if (line.startsWith("## ")) {
            if (line.includes("Execution")) {
                inSection = true;
            }
            else {
                inSection = false;
            }
            continue;
        }
        if (inSection) {
            const match = line.match(/^\d+\.\s+(.+)$/);
            if (match) {
                steps.push(match[1].trim());
            }
        }
    }
    return steps;
}
/** 从 body 中提取 User facts 段落的键值对 */
function extractUserFacts(body) {
    const lines = body.split("\n");
    const facts = {};
    let inSection = false;
    for (const line of lines) {
        if (line.startsWith("## ")) {
            if (line.includes("User facts")) {
                inSection = true;
            }
            else {
                inSection = false;
            }
            continue;
        }
        if (inSection) {
            const match = line.match(/^-\s+(.+?):\s+(.+)$/);
            if (match) {
                facts[match[1].trim()] = match[2].trim();
            }
        }
    }
    return facts;
}
/** 从 body 提取完整 ArtifactBody */
function toBody(body) {
    return {
        user_facts: extractUserFacts(body),
        execution: extractExecutionSteps(body),
        escalate_when: extractListSection(body, "Escalate when"),
    };
}
export function createArtifactRegistry(artifactsDir) {
    return {
        async listHeaders(user) {
            const userDir = join(artifactsDir, user);
            const entries = await readdir(userDir);
            const summaries = [];
            for (const entry of entries) {
                if (!entry.endsWith(".md"))
                    continue;
                const raw = await readFile(join(userDir, entry), "utf-8");
                const { data, body } = parseFrontmatter(raw);
                const artifactId = String(data.name ?? entry.replace(/\.md$/, ""));
                summaries.push({
                    artifact_id: artifactId,
                    header: toHeader(data, body),
                });
            }
            return summaries;
        },
        async load(user, artifactId) {
            const userDir = join(artifactsDir, user);
            const fileName = `${artifactId}.md`;
            const raw = await readFile(join(userDir, fileName), "utf-8");
            const { data, body } = parseFrontmatter(raw);
            return {
                artifact_id: String(data.name ?? artifactId),
                header: toHeader(data, body),
                body: toBody(body),
            };
        },
        async save(user, artifact) {
            const userDir = join(artifactsDir, user);
            await mkdir(userDir, { recursive: true });
            const frontmatter = {
                name: artifact.artifact_id,
                derived_from: artifact.header.derived_from,
                description: artifact.header.title,
            };
            let body = `# ${artifact.header.title}\n\n`;
            if (artifact.header.when_to_use.length > 0) {
                body += "## When to use\n\n";
                for (const item of artifact.header.when_to_use) {
                    body += `- ${item}\n`;
                }
                body += "\n";
            }
            if (artifact.header.escalate_when.length > 0) {
                body += "## Escalate when\n\n";
                for (const item of artifact.header.escalate_when) {
                    body += `- ${item}\n`;
                }
                body += "\n";
            }
            const userFacts = Object.entries(artifact.body.user_facts);
            if (userFacts.length > 0) {
                body += "## User facts\n\n";
                for (const [k, v] of userFacts) {
                    body += `- ${k}: ${v}\n`;
                }
                body += "\n";
            }
            if (artifact.body.execution.length > 0) {
                body += "## Execution\n\n";
                artifact.body.execution.forEach((step, i) => {
                    body += `${i + 1}. ${step}\n`;
                });
                body += "\n";
            }
            if (artifact.body.escalate_when.length > 0) {
                body += "## Escalate when (body)\n\n";
                for (const item of artifact.body.escalate_when) {
                    body += `- ${item}\n`;
                }
                body += "\n";
            }
            const content = `---\n${yaml.dump(frontmatter, { lineWidth: -1 })}---\n${body}`;
            const filePath = join(userDir, `${artifact.artifact_id}.md`);
            await writeFile(filePath, content, "utf-8");
        },
    };
}
//# sourceMappingURL=index.js.map