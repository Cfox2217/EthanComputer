# EthanComputer · 工程状态

## 当前阶段

**v0.1** — Enter + Craft Agent 核心流程

## 已完成

### 2026-04-07 · v0.1 核心骨架

**项目基础设施**
- `pyproject.toml`：依赖 google-adk>=1.0.0, pydantic, pyyaml
- `src/ethan_computer/`：Python 包结构
- `data/`：运行时数据目录（profiles + artifacts）
- `.env.example`：环境变量模板（GOOGLE_API_KEY, ETHAN_USER_ID, ETHAN_DATA_DIR）
- `.gitignore`：排除 data/、Reference/、.env
- Python 3.12 venv，`pip install -e .` 验证通过

**User Profile 数据层** (`user_profile.py`)
- `UserProfile` Pydantic model：name, primary_language, tech_stack, work_style, communication_preference, notes
- YAML 文件读写：`data/profiles/{user_id}.yaml`
- `profile_to_instruction_context()`：转为可注入 agent instruction 的文本

**Artifact Library 数据层** (`artifact_library.py`)
- `Artifact` Pydantic model：name, description, trigger_keywords, context, steps, known_boundaries
- YAML 文件读写：`data/artifacts/{name}.yaml`
- `search_artifacts()`：基于关键词匹配的检索
- 验证通过：CRUD 和搜索功能正常

**Enter Agent** (`agent.py`)
- `LlmAgent(name="enter_agent")` 作为 root_agent
- instruction 包含判断逻辑：有 artifact → 直接执行，无 → 转交 craft
- 工具：`search_artifact_tool`
- sub_agents: [craft_agent]

**Craft Agent** (`craft_agent.py`)
- `LlmAgent(name="craft_agent")` 作为 sub_agent
- instruction 定义执行→总结→沉淀流程
- 工具：`save_artifact_tool`, `read_user_profile`, `update_user_profile`
- `disallow_transfer_to_peers=True`

**ADK 入口** (`agent.py` 根目录)
- 导出 `root_agent`，兼容 `adk run` / `adk web` CLI

**验证结果**
- `import root_agent` 成功，结构正确（enter_agent → [craft_agent]）
- User Profile save/load/序列化 验证通过
- Artifact CRUD + 关键词搜索 验证通过
- `adk web` 需配置 GOOGLE_API_KEY 后可启动

### 2026-04-08 · Session State 初始化

**Session Init** (`session_init.py`)
- `initialize_session_state()`: 从 Config 和 UserProfile 加载数据，注入 session state
- `before_enter_agent_callback()`: Enter Agent 的 before_agent_callback，首次调用时初始化 session state
- 使用 `_session_initialized` 哨兵保证幂等（同一 session 内只初始化一次）
- 异常时 log 并继续，不中断 agent 执行

**Enter Agent 修改** (`agent.py`)
- 新增 `before_agent_callback=before_enter_agent_callback`
- session state 在 instruction 模板解析之前被填充

**单元测试** (`tests/test_session_init.py`)
- 3 tests: 首次初始化、幂等性、空 profile 处理

**验证结果**
- `from ethan_computer.agent import root_agent` 成功，callback 已绑定
- `import agent; agent.root_agent` 成功（ADK CLI 兼容入口）
- 3 个单元测试全部通过

### 2026-04-09 · 第三方 Model 支持

**Model 工厂** (`models.py`)
- `create_model(config)`: 根据模型名判断使用原生 Gemini 还是 LiteLLM
- 判断规则：模型名包含 `/` → `LiteLlm`（第三方），否则 → 原生 Gemini 字符串
- 支持 `api_base` 配置（用于 OpenAI 兼容 API，如智谱 GLM）

**Config 扩展** (`config.py`)
- 新增 `model_api_base` 字段，从 `ETHAN_MODEL_API_BASE` 环境变量读取

**Agent 改动** (`agent.py`, `craft_agent.py`)
- 两个 Agent 均添加 `model=create_model(load_config())`

**依赖更新** (`pyproject.toml`)
- `google-adk>=1.0.0` → `google-adk[extensions]>=1.0.0`（包含 litellm）

**验证结果**
- 默认 Gemini：`model="gemini-2.5-flash"` ✓
- GLM 模拟：`ETHAN_MODEL_NAME=openai/glm-4-flash` → `LiteLlm` 实例 ✓
- import 链、callback 绑定均正常 ✓

**支持的 Model 配置示例**
- Gemini: `ETHAN_MODEL_NAME="gemini-2.5-flash"`
- GLM: `ETHAN_MODEL_NAME="openai/glm-4-flash"` + `ETHAN_MODEL_API_BASE` + `OPENAI_API_KEY`
- OpenAI: `ETHAN_MODEL_NAME="openai/gpt-4o"` + `OPENAI_API_KEY`
- Anthropic: `ETHAN_MODEL_NAME="anthropic/claude-sonnet-4-20250514"` + `ANTHROPIC_API_KEY`

### 2026-04-09 · 核心流程端到端验证与适配

**架构调整**
- Enter Agent 移除 `search_artifact_tool`，改为纯路由器（问候 → 回复，其他 → transfer）
- Artifact 检索移入 `before_enter_agent_callback`，结果通过 `{?artifact_context}` 注入 instruction
- 新增 `after_enter_model_callback`：拦截模型回复，当需要转交时强制注入 `transfer_to_agent`（GLM-4-flash 不会主动调用 transfer 工具）
- 新增 `after_craft_agent_callback`：Craft Agent 完成后若未保存 Artifact，程序化自动保存
- 关键词提取改进：2 字中文窗口 + 英文单词，提升 Artifact 检索命中率

**端到端测试** (`scripts/e2e_test.py`)
- 测试 1（闲聊）：Enter Agent 直接回复 ✅
- 测试 2（学习通道）：陌生任务 → Craft Agent 激活 → Artifact 自动创建 ✅
- 测试 3（高速通道）：同类任务 → Artifact 匹配 → Enter Agent 直接回复 ✅

**关键设计决策**
- GLM-4-flash 的 instruction following 不足以可靠调用 transfer_to_agent，因此用 `after_model_callback` 程序化拦截
- Artifact 自动保存内容为基础设施（由系统生成，非 Craft Agent 手动提炼），质量待提升
- 高速通道通过 callback 注入 artifact context 实现，模型可在 instruction 中读取匹配到的知识

## 待验证

- `adk web` 完整体验（需确认 ADK CLI 与 after_model_callback 的兼容性）
- 长对话中 session state 的 artifact_context 更新行为

## 技术债

| 编号 | 描述 | 状态 | 影响 |
|------|------|------|------|
| TD-001 | Artifact 检索使用关键词匹配，非语义搜索 | 部分缓解 | 2 字窗口改进命中率，但仍是字符串匹配 |
| TD-005 | Artifact 自动保存内容为基础摘要，非结构化步骤 | 待处理 | 需更强的模型或更精细的回调逻辑来提取步骤 |
| TD-006 | Enter Agent 的 transfer 依赖 after_model_callback 强制拦截，非模型自主决策 | 待处理 | 换用 instruction following 更强的模型后可移除此 hack |
| TD-002 | Session 使用 InMemorySessionService，重启丢失 | 待处理 | v0.1 可接受，后续用 SQLite/DB |
| TD-003 | User Profile 采集需 Craft Agent 主动询问 | 待处理 | v0.1 可接受，后续优化为自然采集 |
| TD-004 | User Profile 注入 agent instruction 依赖 session state placeholder | 已解决 | before_agent_callback 在模板解析前填充 state |

## 已知限制

- v0.1 仅支持单用户（user_id 默认 ethan）
- Artifact 不做版本管理，每次覆盖更新
- 无 GUI，仅 CLI/Web 调试界面
- GLM-4-flash 不会自主调用 transfer_to_agent 和 save_artifact_tool，依赖 callback 强制执行
- 高速通道的 Artifact 内容质量取决于自动保存逻辑，非 Craft Agent 手动提炼
- 问候检测基于简单规则（短文本 + 关键词），可能有误判

## 阻塞项

无。

## 2026-04-12 · mempal 记忆系统初始化

**完成事项**
- `mempal init /Users/ethan/EthanComputer` → wing = `EthanComputer`，8 条 taxonomy
- `mempal ingest` 导入 src + docs + tests：51 个 drawer，~1.7 MB
- 清理 `__pycache__/*.pyc`（61 条）、`egg-info`（4 条）、`mempal-usage.md`（27 条）→ 共 purge 102 条
- 清理 taxonomy 垃圾条目：从 2019 条减至 8 条有效 room
- CLAUDE.md 新增 §18 mempal 记忆系统集成规范

**mempal 当前状态**
- wing: `EthanComputer`
- drawers: 51
- rooms: `ethan_computer`(27), `onboarding`(10), `artifacts`(5), `Reference`(3), `callback`(3), `tools`(3), `sub_agents`(2), `version`(1)
- DB: `~/.mempal/palace.db` (~1.7 MB)

**待完善**
- 配置 MCP server（`mempal serve --mcp`）让 AI agent 可直接调用 `mempal_ingest` 写入决策记忆
- 配置 commit 后自动提醒保存决策的 hook
- 下载的 mempalace-book 参考文档：`/Users/ethan/Nutstore Files/EthanNote/Series-articles/mempalace-book/`
