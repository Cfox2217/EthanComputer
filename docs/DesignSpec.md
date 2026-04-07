# EthanComputer产品设计手册

### **A gentle Ethan, a constant computer.**

---

> 这份手册描述的不是一个聊天机器人，也不是一个自动化脚本。**EthanComputer 是一台会学习的个人计算机**——它认识你，记住你，并随着每一次任务变得更懂你。

---

## 〇 设计哲学

苹果曾说：*"The computer for the rest of us."*

EthanComputer 的信念是：**The agent that actually knows you.**

大多数 AI 助手的问题不是不够聪明，而是**每次都像第一次见面**。它们没有记忆，没有上下文，没有对你这个人的真实理解。用户每次都要重新解释自己是谁、在做什么、想要什么。

EthanComputer 从根本上解决这个问题。

它的核心信念只有一句话：

> **一个真正了解你的 Agent，比一个更聪明的 Agent 更有价值。**

---

## 一 系统框架

EthanComputer 由三个核心层构成，每一层职责清晰，互不越界。

```
┌─────────────────────────────────────┐
│           用户                       |
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         Enter Agent                 │
│     首席执行官 · 任务调度中心           │
└──────────────┬──────────────────────┘
               │ 遇到能力缺口时
┌──────────────▼──────────────────────┐
│         Craft Agent                 │
│     首席工程师 · 任务攻坚与知识沉淀      │
└──────────────┬──────────────────────┘
               │ 执行完成后写入
┌──────────────▼──────────────────────┐
│      Artifact Library               │
│     个人知识库 · 系统的长期记忆         │
└─────────────────────────────────────┘
```

这三层的关系是：**Enter Agent 是大脑，Craft Agent 是双手，Artifact Library 是经验。**

---

## 二 核心概念

### 2.1 Enter Agent — 你的首席执行官

Enter Agent 是用户唯一的对话入口。它的职责不是"尽力完成任务"，而是**精确判断任务能否被现有知识完成**。

它做两件事：

- **能完成** → 调取对应 Artifact，立刻执行，不打扰用户
- **不能完成** → 识别能力缺口，将完整控制权移交 Craft Agent

Enter Agent 的智能不体现在执行上，而体现在**判断上**。它是一个极度克制的 Agent——它知道自己的边界在哪里。

---

### 2.2 Craft Agent — 你的首席工程师

Craft Agent 是系统中能力最强的 Agent。它不参与日常对话，只在 Enter Agent 遇到真正的能力边界时被激活。

它的工作流程是：

1. **接手** — 继承完整的对话上下文，理解用户的真实场景
2. **执行** — 独立完成任务，包括尝试、调试、跑通
3. **采集** — 在执行过程中，向用户询问必要的个人信息
4. **总结** — 对本次执行路径进行结构化总结
5. **沉淀** — 将总结写入 Artifact，将用户信息写入 User Profile

> Craft Agent 的核心原则：**先跑通，再总结，最后沉淀。**
>
> Artifact 不是被设计出来的，是被执行出来的。

---

### 2.3 Artifact — 经过验证的执行上下文

Artifact 是 EthanComputer 最重要的概念。

它不是模板，不是文档，不是流程图。**它是一份经过真实执行验证的、自包含的任务执行上下文。**

每一个 Artifact 包含两层：

| 层次 | 内容 | 示例 |
|---|---|---|
| **用户事实层** | 引用自 User Profile 的个人上下文 | 技术栈、语言偏好、工作风格 |
| **执行路径层** | 经 Craft Agent 跑通验证的步骤序列 | 具体操作步骤、已知边界、异常处理 |

Artifact 的价值在于：**Agent 拿到它，不需要问用户任何问题，不需要推断任何信息，可以立刻开始工作。**

这是 EthanComputer 区别于所有其他 AI 助手的根本差异。

---

### 2.4 User Profile — 你的数字身份

User Profile 是用户全局信息的唯一存储位置。它在每次 Session 启动时自动注入系统，所有 Agent 共享，无需额外读取。

它存储的是**跨任务通用的用户事实**：

```
姓名：Ethan
主要语言：中文
技术栈：Python · GCP · FastAPI
工作风格：先看逻辑，再看细节
沟通偏好：简洁，不要废话
```

User Profile 由 Craft Agent 在执行任务过程中**自然采集**——不是通过独立的 onboarding 流程，而是在真实任务场景中按需询问，执行完成后写入。

> 用户永远不需要填写一份"个人信息表"。系统在帮你工作的过程中，自然地认识了你。

---

## 三 数据架构

三个数据层，职责不重叠，更新频率各异，读取成本各自最优。

| 数据层 | 职责 | 更新频率 | 读取方式 |
|---|---|---|---|
| **User Profile** | 全局用户事实 | 低，相对稳定 | Session 启动时一次性注入 |
| **Artifact Library** | 任务级执行上下文 | 中，随执行迭代 | Enter Agent 按需调取 |
| **对话历史** | 原始场景信号 | 高，实时产生 | Agent 交接时完整携带 |

---

## 四 标准流程

### 4.1 常规任务流程

```
用户发起请求
    ↓
Session 启动 → User Profile 注入系统提示
    ↓
Enter Agent 接收请求
    ↓
检索 Artifact Library
    ↓ 命中
直接执行 → 返回结果 → 结束
```

这是 EthanComputer 的**高速通道**。对于系统已经掌握的任务，用户感受不到任何延迟，也不会被问任何问题。

---

### 4.2 能力扩展流程

```
Enter Agent 无法完成任务（能力缺口）
    ↓
完整控制权移交 Craft Agent
（携带：完整对话历史 + User Profile + 现有 Artifact）
    ↓
Craft Agent 独立执行任务
（包括尝试、调试、向用户询问必要信息）
    ↓
任务跑通
    ↓
Craft Agent 对执行过程进行结构化总结
    ↓
生成或更新 Artifact → 写入 Artifact Library
如有新用户信息 → 同步更新 User Profile
    ↓
控制权交还 Enter Agent
    ↓
下一次同类任务，Enter Agent 独立完成
```

这是 EthanComputer 的**学习通道**。每一次 Craft Agent 的介入，都让系统变得更强。

---

### 4.3 Agent 交接原则

- Enter Agent → Craft Agent：**移交完整控制权，携带全量上下文**
- Craft Agent → Enter Agent：**归还控制权，同时完成知识沉淀**
- 交接过程中：**对话历史完整保留，不裁剪，不摘要**

> 全量上下文的传递，是为了让更聪明的 Craft Agent 能够接触到原始信号，而不是 Enter Agent 处理过的二手信息。

---

## 五 设计原则

这五条原则是 EthanComputer 所有设计决策的最终依据。

**① 先执行，后沉淀**
Artifact 必须经过真实执行验证才能生成。系统不接受未经验证的知识。

**② 自包含优先**
Agent 拿到 Artifact，应当能够立刻工作。任何需要额外询问用户的设计，都是系统的缺陷，不是用户的责任。

**③ 信息单一来源**
全局用户信息只存在于 User Profile，不在各 Artifact 中重复。更新一处，全局生效。

**④ 克制的智能**
Enter Agent 的价值不在于"尽力完成"，而在于"精确判断"。知道什么时候该让更强的 Agent 接手，是一种能力。

**⑤ 系统随使用成长**
每一次 Craft Agent 的介入都是一次学习。用户使用 EthanComputer 的时间越长，系统能独立完成的任务就越多。

---

## 六 产品愿景

> 今天的 AI 助手，聪明但健忘。
>
> EthanComputer 的目标，是成为第一个**真正认识你的计算机**。
>
> 不是更快的搜索引擎，不是更聪明的聊天机器人——
>
> 而是一个随着时间，越来越懂你的工作伙伴。

---

*EthanComputer · Product Design Manual · v0.1*
*Confidential — For Internal Use Only*

---

# 附录 A · 技术内核：Google ADK

### *The right engine for the right machine.*

---

## A.1 什么是 Google ADK（2026 现状）

Google Agent Development Kit（ADK）是 Google 推出的开源 Agent 开发框架，目前已进入成熟阶段。2026 年，ADK 已正式发布 Java 1.0.0 版本，Python 版本持续迭代，并在 Google Cloud Next 2026 上作为核心议题进行了深度展示。 

它的核心定位是：**为多 Agent 协作系统提供生产级的编排基础设施。**

ADK 的设计哲学有一个独特的视角——**"context-as-compilation"**，即将 Agent 的上下文视为一种可编译、可结构化的资源，而不是简单的对话历史堆叠。 这个理念与 EthanComputer 的 Artifact 机制高度共鸣。

---

## A.2 2026 年 ADK 的关键能力

ADK 当前具备的核心能力，覆盖了 EthanComputer 所需的全部基础设施：

- **多 Agent 层级编排** — 原生支持 Orchestrator + Sub Agent 树形结构
- **有状态 Session 管理** — Session 生命周期内的上下文持久化
- **丰富的工具生态** — 内置 BigQuery、Spanner、Pub/Sub 等 Google Cloud 服务集成 
- **灵活部署** — 支持本地、Cloud Run、Vertex AI 全链路部署
- **跨语言支持** — Python + Java 双栈，面向生产环境

 

---

## A.3 契合点分析

EthanComputer 的架构与 ADK 的设计哲学在四个关键维度上高度吻合。

### ① 多 Agent 层级结构 → 原生支持

ADK 原生的 Orchestrator → Sub Agent 委派机制，与 EthanComputer 的 Enter Agent → Craft Agent 交接模型**完全一致**：

| EthanComputer 概念 | ADK 对应机制 |
|---|---|
| Enter Agent | Root Orchestrator Agent |
| Craft Agent | Sub Agent（按需激活） |
| 控制权移交 | Agent delegation with full context |
| 控制权归还 | Sub Agent completion → return to root |

不需要任何架构妥协，ADK 的多 Agent 模型直接承载 EthanComputer 的设计。

---

### ② Context-as-Compilation → 与 Artifact 机制天然共鸣

ADK 在 Google Cloud Next 2026 上重点阐述了其 **"context-as-compilation"** 视角——上下文不是被动积累的，而是被主动编译和结构化的。

这与 EthanComputer 的 Artifact 哲学如出一辙：

> Artifact 不是对话历史的堆叠，而是经过 Craft Agent 主动提炼、验证、结构化的执行上下文。

两者在底层认知上完全一致：**上下文是需要被管理的资产，不是需要被存储的负担。** 

---

### ③ 有状态 Session 管理 → User Profile 注入的基础设施

ADK 内置 Session 状态管理，支持在 Session 生命周期内持久化任意上下文。

这正是 EthanComputer 所需要的：

```
Session 启动
    ↓
ADK Session State 初始化
    ↓
User Profile 写入 Session State
    ↓
所有 Agent 在整个 Session 内共享，无需重复读取
```

User Profile 的"一次注入，全局共享"机制，由 ADK 的 Session 基础设施直接承载，零额外工程成本。

---

### ④ 工具生态与云服务集成 → 面向未来的扩展空间

ADK 2026 已深度集成 Google Cloud 全家桶——BigQuery、Spanner、Pub/Sub 等服务均有原生支持，同时保持对第三方工具的开放性。

这为 EthanComputer 提供了清晰的成长路径：

| 阶段 | 部署方式 | 重点 |
|---|---|---|
| **近期** | 本地运行 | 验证 Enter/Craft Agent 核心流程 |
| **中期** | Cloud Run | 多用户支持，Artifact 云端持久化 |
| **远期** | Vertex AI | 企业级安全控制，模型能力升级 |

 

---

## A.4 一句话总结

> ADK 的 context-as-compilation 哲学、多 Agent 编排能力、以及有状态 Session 管理，与 EthanComputer 的每一个核心设计决策都形成了精确的映射关系。
>
> **EthanComputer 是产品愿景，ADK 是实现引擎。** 两者的结合，不是技术选型的妥协，而是理念层面的共鸣。

---

*EthanComputer · 附录 A · Google ADK 技术内核 · v0.1*
*Confidential — For Internal Use Only*