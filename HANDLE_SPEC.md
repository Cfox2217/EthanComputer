# SPEC.md — Ethan Computer MVP 规范（最终版）

> 版本：v1.0（MVP Final）
>
> 状态：当前阶段唯一主规范
>
> 用途：给 Code Agent 说明 Ethan Computer 的**概念、框架、机制、双层内核、模块边界、模块对接方式、MVP 范围、验收型 TUI**，以便先把 MVP 跑起来并验证可行性。

---

# 1. 这份 SPEC 的目标

这份文档不是字段大全，也不是重型架构蓝图。

它的目标只有四个：

1. **让 Code Agent 先理解 Ethan Computer 是什么系统**
2. **让 Code Agent 明白系统是如何流转和增长的**
3. **让 Code Agent 按 MVP 方式先把最小闭环跑起来**
4. **让人类可以通过最小 TUI 参与验收，而不是只看日志文件**

因此，本 SPEC 优先讲清：

- 核心概念
- 系统框架
- 两层内核
- 模块职责
- 请求如何流转
- 能力如何沉淀
- MVP 先做到哪里
- 人类如何参与验收

只有在这些机制说明之后，才补最小技术结构。

---

# 2. Ethan Computer 是什么

Ethan Computer 是一个**长期成长型的个人 Agent 系统**。

它不是一个“每次收到请求都重新思考一遍”的通用 Agent，
也不是一个“把所有能力都塞进一个大 prompt 里”的执行器。

它要做的是：

> **把广义能力（Skill）与个人执行面（Artifact）分离，**
> **让系统在真实使用中逐渐把宽泛能力压缩为可直接调用的个人化能力。**

长期来看，这个系统应当表现为：

- 用得越久，越懂当前用户/当前项目怎么做事
- 调用越多，执行上下文越短
- 越来越少回溯宽泛能力源
- 越来越多直接依赖已经沉淀好的执行面

一句话：

> **Ethan Computer 的目标不是“每次都很会想”，而是“越用越像用户自己的执行界面”。**

---

# 3. 四个核心概念

Ethan Computer MVP 只围绕四个核心概念展开：

## 3.1 Skill

Skill 是能力源。

它描述的是：

> **一类任务理论上如何完成**

Skill 的特点：

- 通用
- 覆盖面广
- 描述完整方法论
- 上下文成本高
- 不适合直接作为日常执行面

Skill 可以来自：

- 本地仓库
- 用户编写
- 模板导入
- 后续社区来源（非 MVP）

在 MVP 阶段，Skill 先只考虑**本地文件**。

---

## 3.2 Artifact

Artifact 是执行面。

它描述的是：

> **这个用户 / 这个项目，实际上怎么做这类事**

Artifact 不是 Skill 的副本。

Artifact 只沉淀：

- 真实触发过的场景
- 当前确实要用的执行路径
- 已知用户事实 / 项目事实
- 已经明确的边界与升级条件

Artifact 要足够轻，能让 L0 直接拿来执行。

---

## 3.3 Enter（L0）

Enter 是用户可见的执行层。

它的职责只有一句话：

> **先看现成的 Artifact 能不能做，能做就直接做；不能做就升级。**

L0 只与用户请求、Artifact、执行过程打交道。

L0 不回溯 Skill，不做广义能力工程。

---

## 3.4 CraftEngine（L1）

CraftEngine 是能力工程层。

它的职责是：

> **在 L0 发现能力缺口时，把 Skill 加工成新的或更完整的 Artifact。**

L1 负责：

- 回溯 Skill
- 裁剪当前任务所需场景
- 注入已知用户信息 / 项目信息
- 生成或扩展 Artifact
- 把结果回交给 L0

L1 不直接负责用户交互。

---

# 4. Ethan Computer 的核心框架

MVP 阶段系统框架如下：

```text
User Request
    ↓
Enter (L0)
    ↓
Read injected Artifact Headers
    ↓
L0 自行判断是否已有可用 Artifact
    ├─ 若足够：加载 Artifact → 执行 → 记录结果
    └─ 若不足：发起 Upgrade → CraftEngine (L1)
                                      ↓
                           回溯 Skill / 裁剪场景 / 注入事实
                                      ↓
                           生成或扩展 Artifact
                                      ↓
                           返回给 L0
                                      ↓
                           L0 继续执行 → 记录结果
```

这就是 Ethan Computer 的最小闭环。

MVP 只需要证明这条链路成立。

---

# 5. 两层内核：为什么这样选

## 5.1 L0 内核：Pi

L0 采用 **Pi** 作为执行内核。

选择原因不是“它定义了 Ethan 的方法论”，而是它适合作为一个**轻量、可嵌入、工具能力强、上下文控制强**的执行底盘。官方文档把 Pi 相关能力描述为最小核心、可嵌入的 agent 运行基础；OpenClaw 也明确说明，如果用户不做额外配置，默认会使用 bundled Pi binary in RPC mode 作为代理运行基础，同时 OpenClaw 也支持更深度的 embedded integration。

对 Ethan 来说，这意味着：

- L0 可以先走轻量底盘
- MVP 阶段不必自己发明 agent loop
- 后续若需要更深控制，也有 embedded 方式可升级
- 但无论底层怎么接，L0 的职责边界不变：只基于 Artifact 执行

## 5.2 L1 内核：Claude Agent SDK

L1 采用 **Claude Agent SDK** 作为能力工程引擎。

原因是它本身就提供了与 Claude Code 同级别的 agent loop、上下文管理、文件读取/编辑、命令执行等内置能力，并支持 hooks、subagents、MCP、permissions、sessions 等机制，适合作为需要多步能力加工与上下文工程的上层引擎。

对 Ethan 来说，这意味着：

- L1 可以专注做 Skill 分析与 Artifact 生成
- 不必自己重造复杂工具调用循环
- 后续引入 Skill 搜索、治理、扩展时也有足够空间

## 5.3 方法论主权仍在 Ethan 自身

虽然底层使用 Pi 和 Claude Agent SDK，但 Ethan 的核心不等于这些底层 SDK。Ethan 的独特之处在于 Skill / Artifact 分层、L0 / L1 职责边界、缺口升级机制、Artifact 自然生长逻辑。

所以必须明确：

> **Ethan 不重新发明 agent loop；Ethan 定义的是更适合长期成长的操作模型。**

---

# 6. L0 与 L1 的职责边界

## 6.1 L0（Enter）负责什么

L0 负责：

1. 接收用户请求
2. 读取当前注入的 Artifact Headers
3. 自己判断是否已有可用 Artifact
4. 若有则加载 Artifact 并执行
5. 若不足则升级给 L1
6. 在 L1 返回后继续执行
7. 记录本次运行结果

L0 的本质是：

> **执行层，不是能力源层。**

## 6.2 L0 不负责什么

L0 不负责：

- 直接读取 Skill
- 分析整个 Skill 库
- 做能力工程
- 维护 Skill 生命周期
- 直接决定系统如何成长

## 6.3 L1（CraftEngine）负责什么

L1 负责：

1. 接收 L0 的升级请求
2. 确定要回溯哪个 Skill
3. 从 Skill 中裁剪当前任务需要的部分
4. 注入当前已知的用户事实 / 项目信息
5. 生成新的 Artifact 或扩展现有 Artifact
6. 把结果回交给 L0
7. 记录这次加工做了什么

L1 的本质是：

> **能力工程层，不是直接执行层。**

## 6.4 L1 不负责什么

L1 不负责：

- 直接面向用户输出最终答复
- 长期接管 L0 的工作
- 在无请求时自行无限扩展 Artifact

---

# 7. Artifact Header 的定位

这是 MVP 里最关键的点之一。

Artifact Header 的作用不是让系统建一个复杂 matcher，
也不是为了支持复杂打分器。

Artifact Header 的作用只有一个：

> **让 L0 用极低的上下文成本知道“有哪些现成执行面可以考虑”。**

也就是说：

- Header 是**L0 的轻量能力目录**
- L0 先读 Header，再自己决定是否加载对应 Artifact
- 匹配动作是 L0 自己做的判断，不是独立的检索子系统

因此，MVP 中 Header 必须极简。

## 7.1 MVP 中 Header 只需要表达

- 这个 Artifact 是干什么的
- 大概什么时候用
- 它来自哪个 Skill
- 哪些情况下不要强行用，应升级

## 7.2 MVP 推荐最小结构

```yaml
artifact_id: artifact-dev-task-breakdown-ethan
header:
  title: Ethan task breakdown
  when_to_use:
    - 把需求拆成开发任务
    - 输出实现计划
  derived_from: dev-task-breakdown
  escalate_when:
    - 当前请求涉及未定义协议
    - 当前请求跨越不清晰模块边界
```

这个结构已经足够 MVP。

不要在 MVP 阶段把 Header 设计成重型协议对象。

---

# 8. Artifact Body 的定位

如果说 Header 是“轻量索引”，那么 Body 才是真正的执行面。

Artifact Body 应表达：

- 当前用户 / 当前项目下怎么做这件事
- 已知事实是什么
- 执行路径大致如何
- 什么时候要升级

## 8.1 MVP 推荐最小结构

```yaml
artifact_id: artifact-dev-task-breakdown-ethan
header:
  title: Ethan task breakdown
  when_to_use:
    - 把需求拆成开发任务
    - 输出实现计划
  derived_from: dev-task-breakdown
  escalate_when:
    - 当前请求涉及未定义协议
    - 当前请求跨越不清晰模块边界
body:
  user_facts:
    project_style: protocol-first
    preferred_output: markdown
  execution:
    - 识别目标
    - 识别影响边界
    - 拆成 1~3 天粒度任务
    - 输出按顺序排列的任务列表
  escalate_when:
    - 缺少必要上下文
    - 当前请求需要新的核心协议
```

这里的重点不是字段多，而是让 L0 能直接用。

---

# 9. Skill 的定位

Skill 是广义能力源。

MVP 中 Skill 不需要做得很复杂，但必须表达清楚：

- 这类任务一般怎么做
- 有哪些典型场景
- 有哪些全局约束

## 9.1 MVP 推荐最小结构

```yaml
skill_id: dev-task-breakdown
version: 0.1.0
title: Break request into engineering tasks
description: 把自然语言需求拆成工程任务
scenarios:
  - feature-breakdown
  - architecture-breakdown
constraints:
  - 不发明未存在的系统边界
```

Skill 在 MVP 中可以很简，但必须存在。

因为 Ethan 的核心不是只有 Artifact，而是：

> **Artifact 必须有能力源可回溯。**

---

# 10. 系统是如何流转的

Ethan Computer MVP 主要有三条机制流程。

## 10.1 流程 A：正常执行流程

当用户发起请求时：

1. L0 接收请求
2. L0 读取当前注入的 Artifact Headers
3. L0 自己判断是否已有可用 Artifact
4. 若有，则加载该 Artifact
5. L0 基于该 Artifact 执行
6. 执行完成后记录运行结果
7. 如有必要，对 Artifact 做小幅更新

这条流程的目标是：

> **能不回溯 Skill，就不回溯 Skill。**

## 10.2 流程 B：能力缺口流程

当 L0 判断现有 Artifact 不足时：

1. L0 生成一个升级请求
2. 把当前请求、已有上下文、当前缺口交给 L1
3. L1 确定要回溯的 Skill
4. L1 从 Skill 中裁出这次需要的场景
5. L1 注入当前已知的用户事实 / 项目信息
6. L1 生成新的 Artifact 或扩展现有 Artifact
7. L1 把结果交还给 L0
8. L0 基于新 Artifact 继续执行
9. 系统记录这次能力沉淀

这条流程的目标是：

> **每一次能力缺口，都尽量转化成一次能力沉淀。**

## 10.3 流程 C：Artifact 自然生长流程

Artifact 不会一次长全。

它应当：

- 在真实请求触发时增长
- 只增长当前真的用到的场景
- 逐步注入用户事实 / 项目事实
- 逐步显式化边界

MVP 不要求完整增长治理，只要求先证明“能长”。

---

# 11. 模块框架与模块对接

MVP 阶段建议把系统拆成以下模块：

```text
packages/
├── protocol-types      # 最小对象定义
├── skill-registry      # 读取本地 Skill
├── artifact-registry   # 读取 / 保存 Artifact
├── enter-runtime       # L0 逻辑
├── craft-engine        # L1 逻辑
└── replay              # 最小 replay
```

## 11.1 protocol-types

职责：

- 定义 Skill / Artifact / Upgrade / Craft Result / Run Record 的最小类型
- 只做最小结构，不做重型 schema 系统

它是其他模块共享的对象层。

## 11.2 skill-registry

职责：

- 从本地文件读取 Skill
- 按 skill_id 获取 Skill
- 提供基础加载能力

MVP 中不负责：

- 社区搜索
- 下载
- 远程同步
- 复杂版本治理

## 11.3 artifact-registry

职责：

- 读取已有 Artifact
- 提供给 L0 注入 Artifact Headers
- 保存新的 Artifact
- 保存对 Artifact 的扩展结果

MVP 中不必实现复杂 patch 系统，
但至少要支持“在原 Artifact 基础上写入扩展版本”或“生成新版 Artifact 文件”。

## 11.4 enter-runtime

职责：

- 接收用户请求
- 读取 Artifact Headers
- 决定加载哪个 Artifact 或是否升级
- 在 L1 返回后恢复执行
- 写入运行记录

这是 MVP 的主入口。

## 11.5 craft-engine

职责：

- 接收升级请求
- 回溯 Skill
- 裁剪出当前需要的内容
- 注入用户 / 项目事实
- 生成新的 Artifact 或扩展结果
- 返回给 L0

## 11.6 replay

职责：

- 读取历史运行记录
- 用相同输入重跑一次主要流程
- 检查系统是否仍然能走通

MVP replay 不求复杂，只要能证明系统具备最小回放能力即可。

---

# 12. 模块如何对接

## 12.1 L0 与 Artifact Registry 的对接

L0 启动或处理请求时，应从 Artifact Registry 取得两类东西：

1. Artifact Headers（供快速判断）
2. 需要时再加载完整 Artifact Body

对接原则：

- 先注入 Header 列表
- 再按需加载具体 Artifact

## 12.2 L0 与 L1 的对接

L0 不把“整个系统问题”扔给 L1，
而是把“当前能力缺口”交给 L1。

因此两者之间的对接对象应很简单：

```yaml
upgrade:
  request: 用户当前请求
  current_artifact: 当前尝试依赖的 Artifact（可空）
  why_not_enough: 当前为什么不足
  known_facts:
    ...
```

MVP 中这就是最小升级对象。

## 12.3 L1 与 Skill Registry 的对接

L1 根据：

- 当前 Artifact 的 derived_from，或
- 当前任务绑定的 skill_id

去 Skill Registry 取 Skill。

然后只裁剪本次所需场景，不把整份 Skill 都塞给 L0。

## 12.4 L1 与 Artifact Registry 的对接

L1 处理后应输出：

- 新 Artifact，或
- 扩展后的 Artifact

Artifact Registry 负责保存。

L0 后续读取的是保存后的 Artifact，而不是直接长期依赖 L1 内存结果。

---

# 13. MVP 的技术选型

MVP 的技术选型必须以“先跑通闭环”为第一原则。

## 13.1 持久化：文件系统优先

MVP 推荐全部使用本地文件系统。

原因：

- 简单
- 易审查
- 易 diff
- 易回放
- 易被 Code Agent 直接操作

推荐结构：

```text
ethan-computer/
├── SPEC.md
├── skills/
│   └── local/
│       └── <skill-name>/
│           └── SKILL.md
├── artifacts/
│   └── ethan/
│       └── <artifact-name>.md
├── runs/
│   ├── logs/
│   ├── crafts/
│   └── replays/
├── packages/
│   ├── protocol-types/
│   ├── skill-registry/
│   ├── artifact-registry/
│   ├── enter-runtime/
│   ├── craft-engine/
│   └── replay/
└── scripts/
```

## 13.2 Skill / Artifact 文件格式

MVP 推荐采用 **SKILL.md 标准格式**（YAML frontmatter + Markdown body）：

- Skill：`SKILL.md` 格式（YAML frontmatter + Markdown body）
- Artifact：同格式（YAML frontmatter + Markdown body）
- Run Record：YAML 或 JSON

SKILL.md 格式结构：

```text
---
name: <小写-连字符-id>
description: <功能描述 + 适用场景>
metadata:
  version: "<语义化版本>"
---

# <标题>

## Scenarios
- <场景说明>

## Constraints
- <约束条件>

## Method
1. <执行步骤>
```

Frontmatter 规范（遵循 Agent Skills Standard）：

- **`name`**（必填）：小写字母、数字、连字符，最多 64 字符，与目录名一致
- **`description`**（必填）：描述功能和适用场景，最多 1024 字符
- **`metadata`**（可选）：扩展信息，如 `version`、`derived_from` 等
- 禁止在 frontmatter 顶层使用非标准字段（如 `scenarios`、`constraints` 应放 body）

理由：

- 可读性高
- 适合手工审查
- 适合快速迭代
- frontmatter 提供结构化元数据，Markdown body 提供自然语言指令
- 与 Claude 生态 SKILL 标准对齐

## 13.3 运行脚本

MVP 至少应有：

- 一个启动主流程的脚本
- 一个 replay 脚本

例如：

- `scripts/run-mvp.ts`
- `scripts/replay-run.ts`

## 13.4 语言与实现风格

MVP 建议使用 TypeScript 或 Python，
但必须满足：

- 文件读写方便
- 类型表达足够清晰
- 对接 Pi / Claude Agent SDK 方便
- Code Agent 易于维护

如果工程主栈已偏向 Node / TypeScript，优先 TypeScript。

---

# 14. MVP 现在不做什么

为了防止 Code Agent 把系统扩散成平台工程，必须明确当前不做：

- 不做复杂 Artifact 检索系统
- 不做独立 matcher 打分子系统
- 不做 embedding / reranking
- 不做社区 Skill 市场
- 不做自动联网 Skill 搜索
- 不做多用户与多租户
- 不做长期记忆总线
- 不做复杂任务编排系统
- 不做 UI / Dashboard
- 不做复杂权限体系

原因很简单：

> **MVP 要验证的是 Ethan 的分层与成长机制，不是验证一个通用 Agent 平台。**

---

# 15. MVP 最小对象

这里不做重型 schema，只定义最小落盘结构。

## 15.1 Skill（最小）

文件：`skills/local/dev-task-breakdown/SKILL.md`

遵循标准 SKILL.md 格式：frontmatter 只含标准字段（`name` + `description`），扩展信息放 `metadata` 或 body。

```markdown
---
name: dev-task-breakdown
description: 把自然语言需求拆成工程任务。适用于将功能需求或架构调整方向拆解为可执行工程步骤的场景。
metadata:
  version: "0.1.0"
---

# Break request into engineering tasks

把自然语言形式的需求拆解为可执行的工程任务列表。

## Scenarios

- **feature-breakdown**: 用户给出功能需求，需要拆成开发任务
- **architecture-breakdown**: 用户给出架构调整方向，需要拆成工程步骤

## Constraints

- 不发明未存在的系统边界
- 不假设未定义的协议
- 任务粒度控制在 1~3 天

## Method

1. 识别用户请求中的目标
2. 识别影响边界
3. 按依赖顺序拆成工程任务
4. 输出按顺序排列的任务列表
```

## 15.2 Artifact（最小）

文件：`artifacts/ethan/artifact-dev-task-breakdown-ethan.md`

同样遵循 SKILL.md 格式：frontmatter 只含标准字段，`derived_from` 放 `metadata`。

```markdown
---
name: artifact-dev-task-breakdown-ethan
description: Ethan 专属的任务拆解执行面。当需要把需求拆成开发任务或输出实现计划时使用。
metadata:
  derived_from: dev-task-breakdown
  version: "0.1.0"
---

# Ethan task breakdown

## When to use

- 把需求拆成开发任务
- 输出实现计划

## Escalate when

- 请求涉及未定义协议

## User facts

- project_style: protocol-first

## Execution

1. 识别目标
2. 识别影响边界
3. 拆成任务

## Escalate when (body)

- 缺少必要上下文
```

## 15.3 Upgrade（最小）

```yaml
request: 把这个需求拆成开发任务
current_artifact: artifact-dev-task-breakdown-ethan
why_not_enough: 这次请求涉及新的核心协议
known_facts:
  current_project: Ethan Computer
```

## 15.4 Craft Result（最小）

```yaml
skill_used: dev-task-breakdown
new_artifact: artifact-dev-task-breakdown-ethan
summary:
  - 新增一个可处理协议缺口的场景
resume_hint: 可以继续执行
```

## 15.5 Run Record（最小）

```yaml
run_id: run_0001
request: 把这个需求拆成开发任务
used_artifact: artifact-dev-task-breakdown-ethan
escalated: true
craft_applied: true
result: success
```

这些最小对象的重点不是字段严密，而是：

> **足够支撑 MVP 跑通。**

---

# 16. MVP 实现顺序（强建议）

MVP 建议严格按以下顺序推进：

## Step 1：先写最小对象文件

先落地：

- 1 个 Skill
- 1 个初始 Artifact（可极简）
- 1 个升级对象格式
- 1 个 craft result 格式
- 1 个 run record 格式

## Step 2：实现 Skill / Artifact 的本地读取

让系统先能：

- 读 Skill
- 读 Artifact Header
- 按需读 Artifact Body

## Step 3：实现 L0 最小主流程

让 L0 先能：

- 接收请求
- 读 Header
- 自行决定用哪个 Artifact 或升级

## Step 4：实现 L1 最小 crafting

让 L1 先能：

- 接收 upgrade
- 读 Skill
- 写出扩展后的 Artifact
- 返还给 L0

## Step 5：实现 L0 恢复执行

证明：

- L1 返回后，L0 可以继续执行而不是停在中间

## Step 6：补最小 run record 与 replay

证明：

- 这条闭环不仅能跑，还能被记录和回放

---

# 17. MVP 演示场景

MVP 至少做一个和项目本身高度相关的场景。

推荐场景：

> **把自然语言需求拆成 Ethan 项目的开发任务**

原因：

- 高频
- 容易验证
- 直接服务 Ethan 开发
- 最容易观察“第一次需要 L1，第二次更多靠 Artifact”的效果

## 17.1 第一次请求应表现为

- L0 读到已有 Headers
- L0 判断当前 Artifact 不够
- L0 升级给 L1
- L1 回溯 Skill 并扩展 Artifact
- L0 继续执行
- 生成任务结果
- 写运行记录

## 17.2 第二次相似请求应表现为

- L0 更直接地依赖已有 Artifact
- 比第一次更少回溯 Skill
- 路径更短或更直接

如果第二次仍与第一次完全一样依赖 L1，说明 MVP 没有验证出成长价值。

---

# 18. MVP 验收标准

只有满足以下条件，MVP 才算成立：

1. 至少有 1 个本地 Skill
2. 至少有 1 个本地 Artifact
3. L0 能读取注入的 Artifact Headers
4. L0 能在已有 Artifact 足够时直接执行
5. L0 能在不足时升级给 L1
6. L1 能基于 Skill 生成或扩展 Artifact
7. L0 能基于新的 Artifact 继续执行
8. 整个过程至少能生成最小运行记录
9. 历史至少 1 次运行可以 replay
10. 第二次相似请求相较第一次更直接依赖 Artifact

MVP 的重点不是功能多，而是：

> **证明 Ethan 的分层与成长机制在最小闭环下成立。**

---

# 19. Debug Console（实时调试终端）

Ethan Computer 的 TUI 定位是**实时 Debug Console**，不是验收展示界面。

它的核心用途：

> **让开发者在运行时清楚看到各模块（L0、L1、Kernel）的响应和处理过程，用于 debug 和后续开发。**

TUI 承担：

- 请求触发入口
- 运行时实时观察窗口（LLM streaming、tool calls、timing）
- 运行结果查看
- replay 触发入口

TUI 不承担：

- 产品级聊天体验
- 配置中心
- 复杂历史分析

---

# 20. Debug Console 规范

## 20.1 布局

左右双栏终端布局：

```text
┌─ Ethan Debug Console ─── L0·决策中 ● 3.2s ──────────────────┐
│                                          │ Context           │
│  ▸ Request                               │                   │
│  │ “帮我拆解这个需求”                       │ Artifact Headers   │
│  └────────────────────────────────────┘   │ ┌───────────────┐ │
│                                            │ │ task-breakdown │ │
│  ── L0 ──────────────────────────────────  │ │ when: 拆任务   │ │
│  ◆ 3 artifact headers loaded              │ │ from: dev-task │ │
│  ◆ LLM → {“action”:”escalate”,...}        │ └───────────────┘ │
│  ⚡ ESCALATE · 缺少协议缺口场景             │                   │
│                                            │ Run Stats         │
│  ── L1 CraftEngine ──────────────────────  │ Duration: 3.2s    │
│  ◆ Skill: dev-task-breakdown              │ LLM calls: 3      │
│  [1] write_file ✓ 45ms                    │ Tool calls: 2     │
│  [2] text response ✓ 32ms                 │                   │
│  📋 Action: extended                      │ Active Skill      │
│                                            │ dev-task-bd       │
│  ── L0 Resume ───────────────────────────  │                   │
│  ◆ Re-loaded 4 headers                    │                   │
│  ◆ EXECUTE · artifact: xxx-ethan          │                   │
│                                            │                   │
│  ── Done ────────────────────────────────  │                   │
│  ✓ success · run_0001 · 3.2s              │                   │
│                                            │                   │
├────────────────────────────────────────────┴───────────────────┤
│ > 输入请求...                          [Enter] Run  [Esc] Quit │
└────────────────────────────────────────────────────────────────┘
```

- **顶部状态栏**：当前阶段（L0决策 / L1处理 / L0恢复 / 完成）+ 计时
- **左侧事件流**：按流程顺序实时展示 L0/L1 所有事件，LLM 响应逐块显示
- **右侧上下文面板**：Artifact Headers 列表 + Run Stats + Active Skill
- **底部输入栏**：始终可用

## 20.2 事件类型

Runtime 通过事件回调向 TUI 发送事件：

```typescript
type TuiEvent =
  | { type: “request”; text: string; runId: string }
  | { type: “headers_loaded”; count: number }
  | { type: “l0_streaming”; text: string }
  | { type: “l0_decision”; action: “execute” | “escalate”; artifact_id?: string; reason?: string }
  | { type: “l1_start”; skill: string }
  | { type: “l1_tool_call”; round: number; tool: string; summary: string; ms: number }
  | { type: “l1_report”; summary: string }
  | { type: “l0_resume”; headersCount: number }
  | { type: “result”; outcome: string; totalMs: number }
```

## 20.3 交互

- **Enter**：提交请求
- **Esc / Ctrl+C**：退出

## 20.4 实现要求

- 用 Ink（React for CLI）组件化渲染
- 实时 streaming：LLM 响应逐块显示
- 色标分层：L0=cyan, L1=yellow, Done=green

### 20.4.1 视觉设计规范

修改 TUI 渲染代码时必须遵守以下规则。

**缩进层级（三级）**

| 层级 | 列位置 | 元素 | 示例 |
|------|--------|------|------|
| L0 | col 0 | 请求、结果 | `> request`、`✓ success` |
| L1 | col 2 | section header、reply 前缀 | `◆ L0 · Agent`、`◉ reply` |
| L2 | col 4–6 | section 内容 | 推理文本、工具调用、metadata |

**间距规则**

- L1 元素（`◆` section header、`◉` reply、`✓` result）统一 `marginTop=1`
- L2 元素（section 内容）紧贴其所属 L1 标记，无额外间距
- AgentRounds 轮次之间 `marginTop=1`
- 不同 run 之间用 `╌` 分隔线 + `marginY=1`
- **核心原则：相同列位置的元素必须有相同的上方间距**

**视觉标识符**

| 标识符 | 颜色 | 用途 |
|--------|------|------|
| `◆` | section 专用色 | 阶段标记（L0=cyan, L1=yellow） |
| `◉` | green bold | 最终回复 |
| `⚡` | yellow | 工具调用 |
| `✓` / `⚠` | green / yellow | 运行结果 |
| `>` | green bold | 用户请求 |

**文本渲染**

- agent 所有输出（推理、流式、回复）统一在同一 section 内渲染，不跳跃
- tool_call 触发时文本归档到 AgentRounds，新文本在底部继续生长
- 不区分"推理"和"回复"——一切都是 agent 的输出
- 流式文本无特殊前缀，与确认文本使用相同样式
- 回复续行严格缩进，不超出前缀标识符的文本起始列

**阶段归组**

- L1 Craft + L1 成果在同一 `marginLeft=4` Box 内，无额外 section header 分隔
- L0 初始阶段的回复归 L0 section
- L0 恢复阶段的回复归 Resume section

## 20.5 验收标准

1. 用户可以输入并运行请求
2. 用户可以实时看到 L0 决策过程（streaming）
3. 用户可以实时看到 L1 tool calls 和 timing
4. 用户可以看到 Artifact Headers 和 Run Stats
5. 全流程闭环可见（L0 → L1 → L0 resume → done）

---

# 21. TUI 与模块的对接

### 对接方式

TUI 不直接替代任何模块。它只接收事件并渲染。

- `enter-runtime`：Config 添加 `onEvent` 回调，在各阶段发射事件
- `craft-engine`：Config 添加 `onEvent` 回调，发射 L1 相关事件
- `pi-kernel`：改用 `messages.stream()` API，逐 token yield

### 数据流

```text
User Input → TUI (onRun) → createEnterRuntime({ onEvent: emit })
                                    ↓
                              EnterRuntime.run()
                              ├── onEvent(“request”)
                              ├── onEvent(“headers_loaded”)
                              ├── onEvent(“l0_streaming”)  ← kernel streaming
                              ├── onEvent(“l0_decision”)
                              ├── CraftEngine.craft({ onEvent: emit })
                              │     ├── onEvent(“l1_start”)
                              │     ├── onEvent(“l1_tool_call”) × N
                              │     └── onEvent(“l1_report”)
                              ├── onEvent(“l0_resume”)
                              ├── onEvent(“l0_streaming”)  ← resume streaming
                              └── onEvent(“result”)
```

---

# 22. 使用原则补充

到当前阶段，Ethan Computer 的交付重点仍然是：

1. 概念成立
2. 分层成立
3. 闭环成立
4. 成长成立

TUI 只是帮助人类参与和验收这个机制的入口，
不是当前阶段的产品重心。

因此，任何 TUI 实现都必须服从以下原则：

- 不偏离 Skill / Artifact / L0 / L1 主结构
- 不为了界面而改写核心机制
- 不把 MVP 资源消耗在 UI 装饰上
- 只做最小但足够有参与感的终端界面

一句话：

> **先让 Ethan 活起来，再让 Ethan 好看。**

---

# 23. 最终约束

这份 SPEC 是当前阶段的唯一主规范。

如果实现出现分歧，优先级如下：

1. 先守住 Skill / Artifact 分离
2. 先守住 L0 只基于 Artifact 执行
3. 先守住 L1 只负责能力工程
4. 先把 MVP 闭环跑通
5. 再考虑补更多技术细节
6. TUI 只能服务验收，不能反过来主导系统设计

最终一句话：

> **Ethan Computer MVP 不是为了证明“它已经很强大”，**
> **而是为了证明“它能以正确的结构开始成长”。**
