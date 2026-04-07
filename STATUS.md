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

## 待验证

- 需要有效 GOOGLE_API_KEY 才能用 `adk web` 进行端到端测试
- Enter → Craft 的 transfer 机制需实际模型调用验证

## 技术债

| 编号 | 描述 | 状态 | 影响 |
|------|------|------|------|
| TD-001 | Artifact 检索使用关键词匹配，非语义搜索 | 待处理 | v0.1 可接受，后续需升级 |
| TD-002 | Session 使用 InMemorySessionService，重启丢失 | 待处理 | v0.1 可接受，后续用 SQLite/DB |
| TD-003 | User Profile 采集需 Craft Agent 主动询问 | 待处理 | v0.1 可接受，后续优化为自然采集 |
| TD-004 | User Profile 注入 agent instruction 依赖 session state placeholder，尚未在运行时验证 | 待处理 | 需实际模型调用验证 |

## 已知限制

- v0.1 仅支持单用户（user_id 默认 ethan）
- Artifact 不做版本管理，每次覆盖更新
- 无 GUI，仅 CLI/Web 调试界面
- agent instruction 中的 `{user_profile_context}` placeholder 需在 session state 中预设

## 阻塞项

无。
