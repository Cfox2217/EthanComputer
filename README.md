# Ethan Computer

**A clean-context, self-growing personal agent system**

Ethan Computer 是一个面向长期使用的个人 Agent 系统架构。  
它的目标不是让 Agent 每次都“重新思考一遍”，而是让系统在真实使用中不断把**宽泛能力**压缩成**可直接执行的个人化能力**，从而实现：

- 更低的上下文冗余
- 更强的个性化执行
- 更稳定的长期成长
- 更少对上游广义能力的反复回溯

一句话来说：

> **你用得越久，系统越懂你；你调用得越多，执行上下文越短。**

---

## 为什么需要 Ethan Computer？

大多数 Agent 系统都会遇到同一个问题：

- 能力定义很宽，但真正执行时只用到其中一小部分
- 用户个人信息需要一遍遍在运行时重新补全
- 上下文越来越长、越来越脏、越来越难维护
- 系统每次做事都像“从零开始思考”

Ethan Computer 解决这个问题的方法不是“堆更多记忆”，而是：

> **把能力源（Skill）和执行面（Artifact）分离。**

- **Skill** 负责描述一类任务“理论上如何完成”
- **Artifact** 负责沉淀“这个用户真实是如何完成的”

这样系统就能在长期使用中，把广义能力逐步压缩成用户自己的、可直接拿来执行的能力表面。

---

## 核心理念

### 1. Skill 是系统的一等公民

Skill 是能力的源头。  
它可以来自：

- 社区
- 本地仓库
- 用户自己编写
- 第三方导入模板

Skill 的特点是：

- 覆盖广
- 场景全
- 通用性强
- 上下文成本高

它负责描述**一类任务的完整方法论**，但并不直接适合作为日常执行上下文。

---

### 2. Artifact 是可执行能力，而不是 Skill 的副本

Artifact 不是对 Skill 的复制。  
它是 **CraftEngine（L1）对 Skill 进行场景裁剪与用户化加工后的结果**。

Artifact 只保留：

- 用户真实触发过的场景
- 已经被验证有用的执行路径
- 尽可能已替换完成的用户真实信息
- 在执行中发现的约束与边界

因此：

> **Skill 描述“这类事都能怎么做”**  
> **Artifact 记录“这个用户实际怎么做这类事”**

随着用户长期使用，Artifact 会持续增长，逐渐成为一个高度个性化、上下文极简、拿来就能执行的能力表面。

---

### 3. Enter（L0）只负责执行，不负责追溯能力源

**Enter** 是直接与用户交互的层，也是所有用户可见响应的生成层。

Enter 的原则非常简单：

> **只基于 Artifact 执行。**

Enter 不直接读取 Skill。  
当现有 Artifact 足够时，Enter 应该直接完成任务。  
当 Artifact 覆盖不足时，Enter 不自行硬撑，而是把任务升级给 L1。

这让 Enter 变成一个：

- 轻量
- 稳定
- 可控
- 低上下文开销

的执行层。

---

### 4. CraftEngine（L1）负责能力工程，而不是直接面向用户

**CraftEngine** 是 Ethan 的能力工程层。

它负责：

- 回溯 Skill
- 裁剪当前任务相关场景
- 替换占位符为用户真实信息
- 生成或扩展 Artifact
- 校准触发词
- 导入、更新、整合 Skill
- 反哺 Enter 继续执行

CraftEngine 不直接对用户说话。  
它的工作是：

> **把“宽泛能力”加工成“可立即执行的个人化能力”。**

---

## 系统框架

### 四个核心对象

#### Skill

能力蓝图。  
广覆盖、通用、来源广泛、上下文开销大。

#### Artifact

执行面。  
由 L1 从 Skill 中裁剪生成，只保留用户真实使用过的场景，并尽可能预先注入用户真实信息。

#### Enter（L0）

执行层。  
只与用户交互，只基于 Artifact 做事。

#### CraftEngine（L1）

能力工程层。  
维护 Skill 和 Artifact 的生命周期，负责能力加工、引入、同步与增长。

---

## 系统内核选型

### Enter（L0）: Pi

Enter 采用 **Pi** 作为执行内核。  
Pi 官方将其定义为一个 **minimal terminal coding harness**，强调最小核心、上下文工程能力、动态上下文控制、skills 按需加载，以及 **interactive / print-JSON / RPC / SDK** 四种集成模式；OpenClaw 官方文档也明确说明，如果用户不做额外配置，默认会使用 **bundled Pi binary in RPC mode** 作为代理运行基础。

这使 Pi 很适合作为 Enter 的底盘，因为 Enter 需要的是：

- 强执行能力
- 强工具调用能力
- 强上下文控制能力
- 轻内核、低侵入、可嵌入

而不是一个替系统决定全部能力语义的重型框架。Pi 官方也明确强调它偏向极简核心，通过扩展、skills、prompt templates 和动态上下文来适配具体工作流，而不是强行规定一种固定方法。 

---

### CraftEngine（L1）: Claude Agent SDK

CraftEngine 采用 **Claude Agent SDK** 作为智能引擎。  
Claude Agent SDK 官方说明其提供与 Claude Code 同级别的 **agent loop、内置工具和上下文管理**，可以让 Agent 自主读取文件、编辑文件、运行命令、搜索网页等；同时还提供 **hooks、subagents、MCP、permissions、sessions** 等能力，适合构建需要工具调用、上下文隔离、外部能力接入与多步推理的生产级 Agent。 

这非常适合 L1，因为 L1 需要处理的不是简单执行，而是更高智能密度的能力工程任务：

- Skill 分析
- 场景裁剪
- 外部 Skill 搜索与引入
- Skill 对比与整合
- Artifact 生成与扩展
- Craft 报告生成

---

### Ethan 自身保留的方法论主权

虽然底层采用 Pi 和 Claude Agent SDK，但 Ethan 的核心不在于底层 SDK 本身，而在于其独有的方法论与协议层：

- Skill / Artifact 的分层结构
- Enter / CraftEngine 的职责边界
- 能力缺口的升级机制
- Artifact 的自然生长模型
- 惰性同步与能力治理逻辑

也就是说：

> **Ethan 不重新发明一个 Agent Loop。**  
> **Ethan 定义的是一套更适合长期成长的 Agent 操作模型。**

---

## 核心工作机制

### 1. 正常执行流程

当用户发起任务时：

1. Enter 基于 Artifact 头信息进行意图匹配
2. 如果已有 Artifact 覆盖当前任务
3. Enter 直接加载 Artifact 并执行
4. 任务完成后进行反思与必要更新

目标是：

> **能不回溯 Skill，就不回溯 Skill。**

---

### 2. 能力扩展流程

如果当前 Artifact 不能覆盖新任务：

1. Enter 将任务升级给 CraftEngine
2. CraftEngine 回溯对应 Skill
3. 从 Skill 中裁剪出本次任务涉及的场景
4. 替换可确定的用户信息
5. 生成或扩展 Artifact
6. 返回 Craft 报告
7. Enter 基于新的 Artifact 继续执行

这意味着每一次能力缺口，都会被转化成一次能力沉淀。

---

### 3. Skill 引入与维护流程

当本地没有合适 Skill 时，L1 可以：

1. 搜索本地 Skill 库
2. 搜索社区 Skill
3. 下载并校验 Skill
4. 整合、归档、更新元信息
5. 生成对应 Artifact
6. 让 Enter 在后续调用中直接使用

因此，L1 不只是“修补 Artifact”，  
它也是整个系统的能力供应链管理层。

---

### 4. Artifact 自然生长流程

Artifact 不会一次性生成所有内容。  
它只会在用户真实触发场景时，逐步增长。

也就是说：

- 用户没用过的分支，不进入 Artifact
- 用户常用的表达，会逐渐校准为更合适的触发词
- 用户真实信息会被逐步填入
- 执行边界会在长期使用中不断被显式化

长期来看，系统会越来越依赖 Artifact，越来越少反复回溯 Skill。

这正是 Ethan Computer 最核心的增长模型。

---

## 一个直观比喻

你可以把 Ethan 理解成这样一个系统：

- **Skill** 是祖传秘籍  
    里面什么都写了，但太厚、太泛、太不贴眼前这件事
    
- **Artifact** 是用户自己的小抄  
    只记真正考过的题，而且已经填好了这个用户自己的答案风格
    
- **Enter（L0）** 是前台  
    先翻小抄，能做就直接做
    
- **CraftEngine（L1）** 是后厨  
    只有当前台发现小抄不够时，才去翻祖传秘籍，裁一页下来，加上用户真实信息，再塞回小抄里
    

所以系统越用越久，就越像这样：

> **前台越来越少翻秘籍，越来越多直接靠用户自己的小抄办事。**

---

## 高层流程图

User Request

   ↓

Enter checks existing Artifacts

   ↓

If covered:

    execute directly from Artifact

   ↓

If not covered:

    send crafting request to L1

   ↓

CraftEngine traces back to Skill

   ↓

Extract only the needed scenario

   ↓

Replace user-known information

   ↓

Create or expand Artifact

   ↓

Return Craft Report

   ↓

Enter resumes execution

---

## 设计原则

### Clean Context First

上下文应该随着使用变得更干净，而不是更臃肿。

### Capability Source ≠ Execution Surface

广义能力与可执行能力必须分离。

### Use-Driven Growth

系统只根据真实使用成长，不做无根据的过度泛化。

### Personalization Should Be Structural

个性化不应该每次运行时临时拼接，而应尽量被固化进 Artifact。

### Governance Over Improvisation

Agent 的长期价值不在于“每次都即兴发挥”，而在于能力可治理、可沉淀、可持续演化。