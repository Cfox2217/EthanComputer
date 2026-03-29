# STATUS
> 用于记录项目当前状态，保证开发可追溯、可接续。  
> 每次完成实际任务后都要更新。

## Current
- **Current Focus**: Phase 3 — L1 Crafting (craft-engine)
- **Last Updated**: 2026-03-29 21:00 GMT+08:00
- **Blockers**: none

## 开发路线（参考 CraftAgent 双内核架构）

### Phase 1：基础设施 ✓
- [x] monorepo 骨架 + tsconfig
- [x] protocol-types（5 个最小接口）
- [x] Skill/Artifact 文件（SKILL.md 标准格式）
- [x] skill-registry + artifact-registry

### Phase 2：Pi 内核集成
- [x] Step 3a: pi-kernel 包（direct-llm 模式，Claude API 驱动；pi-subprocess 预留接口）
- [x] Step 3b: 重写 enter-runtime（LLM 自行判断 artifact/升级，注入 headers 到 system prompt）

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

## Open
- Phase 2: Pi 内核接入
- Phase 4: TUI

## Tech Debt
- enter-runtime 当前是关键词匹配，需替换为 LLM 决策
- GUI 后期直接借鉴 Reference/craft-agents-oss-main 前端

## 参考项目
- **一等参考**: `Reference/craft-agents-oss-main/`（双内核 Pi + Claude Agent SDK）
- **补充参考**: `Reference/openclaw-main/`（全面但复杂）

## Log

### [2026-03-29 20:00 GMT+08:00] 确定完整开发规划
- **Why**: 需要整体路线图指导后续开发，确定 Pi 内核接入方式
- **Changed**: 确立 5 Phase + 8 Step 开发计划；Pi 内核采用 `@mariozechner/pi-coding-agent` 子进程模式
- **Key Decisions**: 先做 TUI 后期做 GUI；CraftAgent 为一等参考；Reference/ 加入 .gitignore

### [2026-03-29 19:29 GMT+08:00] 建立 STATUS.md 机制
- **Why**: 需要让开发过程可追溯、可接续
- **Changed**: 新增 STATUS.md 机制
- **Files**: STATUS.md
- **Next**: 在真实开发任务中持续按此文件更新

---
``