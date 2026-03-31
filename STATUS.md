# STATUS
> 用于记录项目当前状态，保证开发可追溯、可接续。
> 每次完成实际任务后都要更新。

## Current
- **Current Focus**: Phase 4 ✓ — TUI Debug Console 完成
- **Last Updated**: 2026-03-31 01:20 GMT+08:00
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

## 参考项目
- **一等参考**: `Reference/craft-agents-oss-main/`（双内核 Pi + Claude Agent SDK）
- **补充参考**: `Reference/openclaw-main/`（全面但复杂）

## Log
### [2026-03-31 01:20 GMT+08:00] Phase 4 完成：TUI Debug Console
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
