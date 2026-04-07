<div align="center">

# EthanComputer

**A gentle Ethan, a constant computer.**

*一个温柔而坚定的存在。一台始终如一、与你并肩思考的机器。*

[![License: MIT](https://img.shields.io/badge/许可证-MIT-black.svg)](LICENSE)
[![Built with ADK](https://img.shields.io/badge/内核-Google%20ADK-4285F4.svg)](https://google.github.io/adk-docs/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-black.svg)](https://python.org)
</div>

---

## 名字的意思

**Ethan**，源自希伯来语 *אֵיתָן*，经拉丁语圣经传入西方。
它的意思不是强大，不是聪明——而是 **"firm, enduring, solid"**。
坚定。持久。稳固如地基。

**Computer**，源自拉丁语 *computare*——*com*（共同）+ *putare*（推算、思考）。
它最初的意思不是机器，而是 **"to reckon together"**。
并肩推算。一起思考。

所以这个名字说的是：

> *一个温柔而坚定的存在，一台始终如一、与你并肩思考的机器。*

不是更聪明的工具。是一个真正认识你、始终在场的长期伴侣。

---

## 问题所在

大多数 AI 助手，都是聪明的陌生人。

每次对话从零开始。你要重新解释自己是谁、在做什么项目、用什么技术栈、喜欢什么风格——**一遍又一遍。**

它们很聪明。但它们不认识**你**。

更重要的是——它们不在场。用完即走，没有积累，没有记忆，没有成长。

EthanComputer 想做的，是那个**一直在的那个**。

---

## 它是什么

EthanComputer 是一个个人 AI Agent 系统。

它不只是回答问题。它**记住你的上下文，从每次任务中学习，随时间持续成长**——直到它对你的了解，比任何工具都深。

它的目标只有一个：**成为你最信任的那台机器。**

---

## 工作原理

EthanComputer 基于 **Google ADK** 构建，运行在双 Agent 架构之上：

```
You
 │
 ▼
┌─────────────────────────────┐
│        Enter Agent          │  ← Your daily interface
│   Knows you. Routes tasks.  │    Handles what it already knows
└──────────────┬──────────────┘
               │ Knowledge gap detected
               ▼
┌─────────────────────────────┐
│        Craft Agent          │  ← Your specialist
│  Executes. Learns. Saves.   │    Tackles new challenges
└──────────────┬──────────────┘
               │ Task complete
               ▼
┌─────────────────────────────┐
│      Artifact Library       │  ← Your system's memory
│  Verified execution context │    Grows with every task
└─────────────────────────────┘
```

**Enter Agent** 是你的日常界面。它了解你的偏好、技术栈和工作风格。对于已经掌握的任务，它直接执行——温和、迅速、不问废话。这是 *gentle* 的体现。

**Craft Agent** 在 Enter Agent 遇到真正边界时激活。它完整接管，独立攻克，完成后将所学写入系统。下次同类任务，Enter Agent 自己就能搞定。这是 *constant* 的体现——系统永远在成长。

**Artifact Library** 是系统的长期记忆。不是模板，不是文档，而是经过真实执行验证的任务上下文——从真实任务中生长出来，随时可以复用。这是 *enduring* 的体现——每一次任务都留下痕迹。

---

## 核心概念

### 🪨 Artifact — 坚固的执行记忆

Artifact 不是模板。它是 Craft Agent **跑通、验证、结构化**之后的任务执行上下文。

Enter Agent 拿到一个 Artifact，就拥有了完成任务所需的一切：

- 你的个人上下文（来自 User Profile）
- 上次跑通的完整步骤
- 已知的边界情况和处理方式

无需猜测，无需询问，直接执行。*Solid.*

### 👤 User Profile — 你的数字底色

关于你的唯一信息源。每次 Session 启动时自动注入，所有 Agent 共享。

```yaml
姓名: Ethan
主要语言: 中文
技术栈: [Python, GCP, FastAPI]
工作风格: 先看逻辑，再看细节
沟通偏好: 简洁，不要废话
```

它不需要手动填写。Craft Agent 在真实任务过程中自然采集——在正确的时机问正确的问题，执行完成后悄悄写入。*Gentle.*

### ⚡ Enter Agent — 温柔的执行者

你的主要交互入口。它的智能不体现在执行上，而体现在**判断**上——清楚地知道自己能处理什么，也清楚地知道什么时候该让更强的 Agent 接手。

不打扰你，不问废话，不让你重复自己。*Gentle.*

### 🔧 Craft Agent — 持久的学习者

你的专项攻坚手。只在 Enter Agent 遇到真正能力边界时被激活。

它继承完整上下文，独立完成任务，并且每次执行结束后都让系统比之前更强。永不停止成长。*Constant.*

---

## 为什么选择 Google ADK？

EthanComputer 的内核是 **Google Agent Development Kit（ADK）**——这不是偶然。

ADK 的 *context-as-compilation* 哲学与 EthanComputer 对 Artifact 的理解高度一致。它原生的多 Agent 编排机制直接承载了 Enter → Craft 的控制权交接，无需任何架构妥协。它内置的有状态 Session 管理，正是 User Profile 注入机制所需要的基础设施。

两者不是技术选型上的凑合，而是理念层面的共鸣：**持续在场，始终如一。**

---

## 开发路线

| 阶段 | 重点 | 状态 |
|------|------|------|
| **v0.1** | Enter + Craft Agent 核心流程 | 🔨 开发中 |
| **v0.2** | Artifact Library 持久化 | 📋 计划中 |
| **v0.3** | User Profile 自动构建 | 📋 计划中 |
| **v0.4** | 集成主流IM方便远程协作 | 📋 计划中 |
| **v0.5** | 优雅高效的GUI提供便捷的操作 | 📋 计划中 |
| **v0.6** | 丰富的个人知识库构建 | 📋 计划中 |
| **v1.0** | Cloud Run 云端部署 | 🔭 未来规划 |
| **v2.0** | Vertex AI 深度集成 | 🔭 未来规划 |

---

## 设计信条

> *Ethan*——坚定，持久，温柔。
> *Computer*——并肩推算，始终在场。

大多数 AI 工具在优化**能力**。EthanComputer 在优化**陪伴的质量**。

一个更聪明的 Agent 是有用的。
一个真正认识你、始终在场的 Agent，是不可替代的。

---

<div align="center">

*A gentle Ethan, a constant computer.*

MIT License · 由 Ethan 用心构建 · 内核驱动：[Google ADK](https://google.github.io/adk-docs/)

</div>