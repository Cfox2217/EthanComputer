# STATUS
> 用于记录项目当前状态，保证开发可追溯、可接续。
> 每次完成实际任务后都要更新。

## Current
- **Current Focus**: Phase 3 — L1 Crafting (craft-engine)
- **Last Updated**: 2026-03-29 22:30 GMT+08:00
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
  - 注入所有 Artifact Headers 到 system prompt（title, when_to_use, escalate_when）
  - LLM 输出结构化 JSON：`{"action":"execute","artifact_id":"...","execution_plan":"..."}`
  - RunRecord 写入 runs/logs/
- [x] 端到端验证通过（scripts/debug-api.ts）
  - "帮我把这个需求拆成开发任务" → execute + 命中 artifact
  - "帮我写一个数据库迁移脚本" → escalate

### Phase 3：L1 Crafting
- [ ] Step 4: 创建 craft-engine 包（接收 Upgrade → 回溯 Skill → 生成 Artifact）
- [ ] Step 5: L0 恢复执行（L1 返回后继续）

### Phase 4：TUI
- [ ] Step 6: 创建 tui 包（SPEC §20-21 验收型终端，6 面板）
- [ ] Step 7: 集成脚本（run-mvp.ts / replay-run.ts）

### Phase 5：Run Record & Replay
- [ ] Step 8: 创建 replay 包（记录 + 回放 + 差异比较）

### 后期（非 MVP）
- GUI（借鉴 CraftAgent React + Tiptap 前端）
- Skill 市场、远程同步等

## Tech Debt
- GUI 后期直接借鉴 Reference/craft-agents-oss-main 前端

## 参考项目
- **一等参考**: `Reference/craft-agents-oss-main/`（双内核 Pi + Claude Agent SDK）
- **补充参考**: `Reference/openclaw-main/`（全面但复杂）

## Log

### [2026-03-29 22:30 GMT+08:00] Phase 2 完成：L0 内核集成验证通过
- **Why**: 需要证明 Artifact Header 注入 → LLM 自决策链路成立
- **Changed**: pi-kernel（direct-llm 模式）+ enter-runtime（LLM 决策替代关键词匹配）
- **Files**: packages/pi-kernel/, packages/enter-runtime/, scripts/debug-api.ts
- **Validated**: 端到端 API 调用，LLM 正确判断 execute/escalate
- **Next**: Step 4 craft-engine

### [2026-03-29 20:00 GMT+08:00] 确立完整开发规划
- **Why**: 需要整体路线图，确定 Pi 内核接入方式
- **Changed**: 5 Phase + 8 Step 开发计划；CraftAgent 为一等参考
- **Key Decisions**: 先 TUI 后 GUI；Reference/ 加入 .gitignore

### [2026-03-29 19:29 GMT+08:00] 建立 STATUS.md 机制
- **Why**: 需要让开发过程可追溯、可接续
- **Changed**: 新增 STATUS.md 机制
- **Files**: STATUS.md

---
