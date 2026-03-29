---
name: create-skill
description: 创建标准格式的 SKILL.md 文件。当需要为 Ethan Computer 系统新建 Skill 时使用。
metadata:
  version: "0.1.0"
---

# Create a standard Skill

按照标准 SKILL.md 格式创建新的 Skill 文件。

## Standard format

一个标准 Skill 是一个目录，包含 `SKILL.md`：

```text
skills/local/<skill-name>/
└── SKILL.md
```

### Frontmatter rules

必须字段：
- `name`: 小写字母、数字、连字符，最多 64 字符，必须与目录名一致
- `description`: 描述功能和适用场景，最多 1024 字符

扩展字段（放在 metadata 下）：
- `metadata.version`: 语义化版本号

禁止：
- 不要在 frontmatter 顶层放非标准字段
- 不要用点号（`.`）命名，用连字符（`-`）

### Body structure

Markdown body 按需包含以下段落：

- `## Scenarios` — 列出适用场景及说明
- `## Constraints` — 列出约束条件
- `## Method` — 有序列出执行步骤

## Steps

1. 确认 skill 的 `name`（小写-连字符格式）和 `description`
2. 创建目录 `skills/local/<name>/`
3. 创建 `SKILL.md`，写入标准 frontmatter 和 body
4. 验证：`name` 与目录名一致，description 清晰描述功能和触发条件
