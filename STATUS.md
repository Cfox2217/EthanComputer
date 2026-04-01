# STATUS
> 用于记录项目当前状态，保证开发可追溯、可接续。
> 每次完成实际任务后都要更新。

## Current
- **Current Focus**: Phase 4 ✓ — Agent 决策过程完整展示（L0 + L1 reasoning steps 累积不丢失）
- **Last Updated**: 2026-04-01 16:00 GMT+08:00
- **Blockers**: none

## 开发路线（参考 CraftAgent 双内核架构）

### Phase 1：基础设施 ✓
- [x] monorepo 骨架 + tsconfig
- [x] protocol-types（5 个最小接口）
- [x] Skill/Artifact 文件（SKILL.md 标准格式）
- [x] skill-registry（读取本地 Skill，从 body 解析 scenarios/constraints）
- [x] artifact-registry（读取/保存 Artifact，headers + body 按需加载）
- [x] CLAUDE.md §15 一等参考项目说明
- [x] .gitignore 加入 Reference/

### Phase 2：内核集成 ✓
- [x] Step 3a: pi-kernel 包
  - PiKernel 统一接口（start/prompt/stop + AsyncGenerator 事件流）
  - DirectLLM 实现（Claude API，glm-5.1 via 智谱 Anthropic 兼容端点）
  - Pi subprocess 接口预留（后续接入 @mariozechner/pi-coding-agent）
- [x] Step 3b: enter-runtime 重写
  - 删除关键词匹配，改为 LLM 自行决策
  - 注入所有 Artifact Headers 到 system prompt
  - LLM 输出结构化 JSON：execute / escalate
  - RunRecord 写入 runs/logs/
- [x] 端到端验证通过（scripts/debug-api.ts）

### Phase 3：L1 Crafting
- [x] Step 4: 创建 craft-engine 包
  - CraftEngine 接口：CraftRequest → CraftOutput（report + artifact_path）
  - Agentic loop：基于 Anthropic SDK tool use
  - 工具集：read_file, edit_file（定点修改）, write_file（新建）
  - L1 系统提示词：极简流程化设计（角色 → 输入 → 目标 → 工具 → 工作顺序 → 产出格式 → 禁止项）
  - 已有 artifact 内容预注入 user message（省去 read_file 轮次）
  - Skill headers + 目标 Skill 全文注入 system prompt
  - Craft 报告结构化格式：Action / What was added / How L0 should continue / Open boundaries
  - 性能优化：修改场景从 ~106s 降到 ~45s
  - 验证通过（verify-craft.ts）
- [x] Step 5: L0 恢复执行（L1 返回后继续）
  - 新增 session-store 包（最小会话记录层， JSONL 格式持久化）
  - enter-runtime 通过 SessionRecorder 记录和恢复会话
  - pi-kernel 新增 ChatMessage 类型和 promptMessages()，支持多轮对话
  - L0 恢复时从 recorder 获取完整会话历史
  - L0 先参考 L1 craft report 决定如何继续，不是盲跑决策循环
  - 验证通过（verify-step5.ts,58s 完成 escalate→craft->resume->success 全流程）

### Phase 4：TUI ✓
- [x] Step 6: 创建 tui 包（Debug Console，左右双栏实时事件流）
  - pi-kernel 改用 messages.stream() 实现 true streaming
  - enter-runtime 添加 onEvent 回调，在各阶段发射 TuiEvent
  - craft-engine 添加 onEvent 回调，发射 L1 tool call/report 事件
  - tui 包：chalk + ANSI escape codes，alternate screen buffer
  - 左栏：卡片式事件流（L0/L1/Resume/Done）；右栏：Artifact Headers + Run Stats
- [x] Step 7: 集成脚本（run-mvp.ts）
- [x] Step 7.5: TUI 流式思考 + L1 成果展示
  - pi-kernel: 新增 ThinkingDeltaEvent，callLLM/callWithTools 捕获 thinking_delta
  - protocol-types: 新增 l0_thinking, l1_thinking, l1_streaming, l1_craft_result 事件
  - enter-runtime: 透传 L0 思考过程到 TUI
  - craft-engine: 从 create 改为 stream，捕获 thinking/text delta，解析 craft report 发射 l1_craft_result
  - tui: ThinkingBlock 组件（灰色 dim + 左竖线）、CraftResultSection（artifact 路径 + 继续建议）
  - 视觉层级：回复 > L1 成果 > section headers / 工具调用 > 思考过程

### Phase 5：Run Record & Replay
- [ ] Step 8: 创建 replay 包（记录 + 回放 + 差异比较）

### 后期（非 MVP）
- GUI（借鉴 CraftAgent React + Tiptap 前端）
- Skill 市场、远程同步等

## Tech Debt
- GUI 后期直接借鉴 Reference/craft-agents-oss-main 前端
- craft-engine: 无对应 Skill 场景当前未处理（agent 自行决策），后续需评估是否需要显式 fallback
- craft-engine: agentic loop 无 token 用量统计，后续需加
- craft-engine: 新建场景 write_file 仍需输出完整文件，速度受限于模型生成时间
- tui: 当前用 chalk + ANSI，不支持复杂交互（滚动、选中、tab 切换），后续如需更好体验考虑 pi-tui 或 blessed
- tui: streaming 时每次 text_delta 全量重绘，高频率 streaming 时可能闪烁，后续可优化为增量渲染
- pi-kernel: streaming 使用 Anthropic SDK 的 stream() API，需确认智谱兼容端点支持 SSE
- pi-kernel: 已添加 thinking 配置参数，但当前使用的 GLM-5.1 不支持 extended thinking（仅 GLM-5/4.7/4.5/4.6 支持），如需思考能力需切换模型
- tui: ThinkingBlock 全量显示不截断，思考内容很多时可能占大量屏幕空间

## 参考项目
- **一等参考**: `Reference/craft-agents-oss-main/`（双内核 Pi + Claude Agent SDK）
- **补充参考**: `Reference/openclaw-main/`（全面但复杂）

## Log
### [2026-04-01 16:00 GMT+08:00] Agent 推理过程完整保留 + L0/L1 统一展示
- **Why**: 用户反馈 L0 决策过程完全看不到，只有 L1 有。根本原因：tool_call 事件清空 streamingText 时没有保存到 reasoning steps
- **Root cause**: 
  1. `l0_tool_call` 清空 `streamingText` 时文本丢失（没有先保存）
  2. `l1_tool_call` 同样清空 `l1StreamingText` 导致中间轮次文本丢失
  3. `l0_agent_reasoning` 事件依赖 `response.text` 非空，某些模型不产出文本时该事件不触发
- **Changed**:
  - `events.ts`: 彻底重写事件处理。`l0_tool_call` 先保存 streamingText 到 `l0ReasoningSteps` 再清空；`l1_tool_call` 先保存到 `l1ReasoningSteps`；`l1_report` 保存最后的 craft report 文本。`l0_decision` 不再清空 streamingText。去重：同 round 不重复添加
  - `EventStream.tsx`: L1 也使用 `AgentRounds` 组件展示推理 + 工具调用。L0 和 L1 都全量显示不截断。回复 section 只显示确认后的 l0Reply
  - 移除 `l0ThinkingText`、`l1ThinkingText`、`l0ResumeThinkingText` 字段（GLM-5.1 不支持 extended thinking，暂时无用）
- **Architecture**: streaming 文本在清空前必须先保存到 reasoning steps，确保 agent 完整决策链始终可见
- **Validated**: 全部包 tsc --noEmit 编译通过
- **Next**: Phase 5 Run Record & Replay（Step 8）

### [2026-04-01 15:00 GMT+08:00] Agent 推理过程展示
- **Why**: 用户需要看到 agent 的决策链——每轮循环为什么调用工具、看到了什么、下一步怎么想。不是 API 层的 extended thinking，而是 agent loop 每轮迭代的推理文本
- **Changed**:
  - `packages/protocol-types/src/index.ts`: 新增 `l0_agent_reasoning` 事件；`l0_tool_call` 新增 `round` 字段
  - `packages/enter-runtime/src/index.ts`: 每轮 tool-calling 迭代后 emit `l0_agent_reasoning`（round + 推理文本）；`l0_tool_call` emit 添加 round
  - `packages/tui/src/events.ts`: 新增 `l0ReasoningSteps` 字段和 `ReasoningStep` 类型；`l0_tool_call` handler 保存 round
  - `packages/tui/src/EventStream.tsx`: 新增 `AgentRounds` 组件，按 round 合并推理文本 + 工具调用，分组展示
- **Architecture**: Agent 每轮迭代的 `response.text`（模型在调用工具时的推理说明）作为推理过程保存，按 round 分组展示。推理和工具调用通过 round number 关联
- **Validated**: 核心包 tsc --noEmit 编译通过
- **Next**: Phase 5 Run Record & Replay（Step 8）

### [2026-04-01 14:00 GMT+08:00] TUI thinking 全量显示 + 回复流式打印 + thinking 参数支持
- **Why**: 用户要求：1) 思考过程不折叠不截断，完整显示；2) 正式回复需要流式打印在回复区域；3) 发现 GLM-5.1 不支持 extended thinking
- **Root cause**: GLM-5.1 的 reasoning mode 默认为 none，所有内容通过 text_delta 输出，不存在 thinking_delta。所谓"思考变成回复"实际上是 text_delta（即回复本身）被错误地渲染为思考样式
- **Changed**:
  - `packages/tui/src/EventStream.tsx`: ThinkingBlock 全量显示（移除 3 行截断和 70 字符截断）；移除"思考中…"假占位符；回复区域改为流式打印（text_delta 直接在回复 section 显示，带 "(streaming)" 标记）；移除 ReplyPreview 组件；L1 流式文本全量显示
  - `packages/pi-kernel/src/index.ts`: 新增 `thinking` 配置参数（`{ type: "enabled", budget_tokens: N }`），传入 Anthropic stream 调用，为后续切换到思考模型做准备
- **Architecture decisions**:
  - 回复区域改为 IIFE 内联计算：优先显示 l0Reply（确认），其次显示当前 phase 的 streamingText（流式）
  - ThinkingBlock 只在有真实 thinking_delta 内容时显示，不再显示假占位符
  - thinking 参数是 opt-in，不配置时不传给 API（避免不支持模型的兼容性问题）
- **Validated**: 核心包 tsc --noEmit 编译通过
- **Next**: Phase 5 Run Record & Replay（Step 8 replay 包）；或切换到支持 thinking 的模型（GLM-5/4.7）验证思考流式显示

### [2026-04-01 10:00 GMT+08:00] 修复 thinking 与 reply 混淆
- **Why**: L0 resume 阶段的思考过程和回复被混淆——streamingText（text_delta，模型实际输出）被渲染成灰色 dim 看起来像思考，然后突然变成正式回复。同时 resume 阶段的 l0_thinking 事件写入 l0ThinkingText 但 resume section 读 l0ResumeThinkingText（从未更新）
- **Root causes**:
  1. streamingText（text_delta）用灰色 dim 渲染，视觉上等同于 thinking
  2. l0_thinking 事件在 resume 阶段未路由到 l0ResumeThinkingText
  3. l1StreamingText 也用灰色 dim 渲染
- **Changed**:
  - `packages/tui/src/events.ts`: applyEvent 根据 phase 路由 l0_thinking/l0_streaming 到 resume 专用字段（l0ResumeThinkingText/l0ResumeStreamingText）；新增 l0ResumeStreamingText 字段
  - `packages/tui/src/EventStream.tsx`: 彻底重构渲染逻辑——ThinkingBlock（灰色 dim + ┃）只用于 thinking_delta；ReplyPreview（白色正常权重）用于 text_delta；L1 streaming text 用黄色 ▸ 前缀区分
- **Architecture decisions**: 借鉴 Gemini CLI ThinkingMessage vs GeminiMessage 模式——thinking 和 reply 是不同类型的内容，用不同组件渲染，不同视觉权重
- **Validated**: 核心包 tsc --noEmit 编译通过
- **Next**: Phase 5 Run Record & Replay（Step 8 replay 包）

### [2026-03-31 16:00 GMT+08:00] Step 7.5 完成：TUI 流式思考 + L1 成果展示
- **Why**: 需要实时展示 L0/L1 的思考过程、工具调用、L1 craft 成果和继续建议，让用户能观察 agent 的推理链路
- **Changed**:
  - `packages/pi-kernel/src/protocol.ts`: 新增 `ThinkingDeltaEvent` 类型
  - `packages/pi-kernel/src/index.ts`: `callLLM`/`callWithTools` 捕获 `thinking_delta` 事件，新增 `onThinking` 回调
  - `packages/protocol-types/src/index.ts`: TuiEvent 新增 `l0_thinking`, `l1_thinking`, `l1_streaming`, `l1_craft_result`
  - `packages/enter-runtime/src/index.ts`: 透传 `onThinking` 回调
  - `packages/craft-engine/src/index.ts`: L1 从 `create` 改为 `stream`，流式发射 thinking/text/tool events，解析 craft report 发射 `l1_craft_result`
  - `packages/tui/src/events.ts`: RunState 新增 thinking/streaming/craftResult 字段
  - `packages/tui/src/EventStream.tsx`: ThinkingBlock（灰色 dim + 左竖线）、CraftResultSection（artifact 路径 + 继续建议）、视觉层级优化
- **Tech debt**:
  - L0 恢复阶段的 thinking 目前复用 `l0_thinking` 事件但需要在 events.ts 中单独跟踪（当前 l0_resume 阶段的 thinking 在 l0ResumeThinkingText 中但 enter-runtime 尚未区分 resume 阶段的 thinking 事件）
- **Files**: packages/pi-kernel/src/protocol.ts, packages/pi-kernel/src/index.ts, packages/protocol-types/src/index.ts, packages/enter-runtime/src/index.ts, packages/craft-engine/src/index.ts, packages/tui/src/events.ts, packages/tui/src/EventStream.tsx
- **Validated**: 核心包 tsc --noEmit 编译通过
- **Next**: Phase 5 Run Record & Replay（Step 8 replay 包）
- **Why**: 需要实时观察各模块（L0/L1/Kernel）的响应和处理，用于 debug 和后续开发
- **Changed**:
  - 新增 `packages/tui/`（chalk + ANSI escape codes，左右双栏实时 Debug Console）
  - `packages/pi-kernel/`：改用 `messages.stream()` API，逐 token yield text_delta
  - `packages/enter-runtime/`：添加 `onEvent` 回调，在各阶段发射 TuiEvent
  - `packages/craft-engine/`：添加 `onEvent` 回调，发射 L1 tool call/report 事件
  - `packages/protocol-types/`：新增 `TuiEvent` 联合类型
  - `HANDLE_SPEC.md` §19-21：替换为 Debug Console 规范
  - `scripts/run-mvp.ts`：集成 TUI 的启动脚本
- **Architecture decisions**:
  - 放弃 Ink（yoga-layout 3.x 的 top-level await 与 tsx CJS 模式不兼容）
  - 改用 chalk + 原生 ANSI escape codes，更轻更稳定
  - TUI 定位从"验收型 Console"改为"Debug Console"
- **Tech debt**:
  - streaming 全量重绘可能闪烁（后续增量渲染）
  - 需验证智谱端点 SSE streaming 兼容性
- **Files**: packages/tui/*, packages/pi-kernel/src/index.ts, packages/enter-runtime/src/index.ts, packages/craft-engine/src/index.ts, packages/protocol-types/src/index.ts, scripts/run-mvp.ts
- **Validated**: 全部包编译通过，TUI import 正常
- **Next**: Phase 5 Run Record & Replay（Step 8 replay 包）

### [2026-03-30 03:50 GMT+08:00] Step 5 完成：L0 恢复执行 + 会话管理
- **Why**: L0 升级后需要能恢复会话继续处理
- **Changed**:
  - 新增 `session-store` 包（最小 JSONL 持久化， Line 1 = header, Lines 2+ = messages）
  - `enter-runtime` 通过 `SessionRecorder` 记录和恢复会话
  - `pi-kernel` 新增 `ChatMessage` 类型和 `promptMessages()`，支持多轮对话
  - L0 恢复时从 recorder 获取完整会话历史
  - L0 先参考 L1 craft report 决定如何继续，不是盲跑决策循环
  - 验证通过（verify-step5.ts，58s 完成 escalate→craft->resume->success 全流程)
- **Files**: packages/session-store/*, packages/enter-runtime/src/index.ts, packages/pi-kernel/src/index.ts, packages/pi-kernel/src/protocol.ts, scripts/verify-step5.ts
- **Next**: Phase 4 TUI：L1 系统提示词重构 + edit_file + 性能提升
- **Why**: L1 响应过慢（修改场景 ~106s），系统提示词目的导向不够明确
- **Changed**:
  - L1 系统提示词重构为极简流程化设计（专家定制版）
  - 新增 edit_file 工具（old_string → new_string 定点修改），避免重写整个文件
  - 已有 artifact 内容预注入 user message，省去 read_file 轮次
  - Craft 报告改为结构化格式
- **Performance**: 修改场景 106s → 45s；新建场景 66s → 50s
- **Files**: packages/craft-engine/src/index.ts, scripts/verify-craft.ts
- **Next**: Phase 4 TUI（Step 6 创建 tui 包）

### [2026-03-30 00:15 GMT+08:00] Step 4 完成：craft-engine 包创建 + 验证通过
- **Why**: 需要实现 L1 能力工程层，L0 升级后由 L1 基于 Skill 生成/完善 Artifact
- **Changed**: 新增 packages/craft-engine/（CraftEngine + agentic loop + tool use）
- **Files**: packages/craft-engine/package.json, tsconfig.json, src/index.ts; scripts/verify-craft.ts
- **Validated**: 全新需求 + 已有 artifact 修改两个场景均通过

### [2026-03-29 22:30 GMT+08:00] Phase 2 完成：L0 内核集成验证通过
- **Why**: 需要证明 Artifact Header 注入 → LLM 自决策链路成立
- **Changed**: pi-kernel + enter-runtime（LLM 决策替代关键词匹配）
- **Validated**: 端到端 API 调用，LLM 正确判断 execute/escalate

### [2026-03-29 20:00 GMT+08:00] 确立完整开发规划
- **Changed**: 5 Phase + 8 Step 开发计划；CraftAgent 为一等参考

---
