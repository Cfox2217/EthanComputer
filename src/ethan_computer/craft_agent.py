"""Craft Agent — 首席工程师 · 任务攻坚与知识沉淀。

只在 Enter Agent 遇到能力缺口时被激活。
核心原则：先跑通，再总结，最后沉淀。
"""

from google.adk.agents.llm_agent import LlmAgent

from .config import load_config
from .models import create_model
from .tools.artifact_tools import save_artifact_tool
from .tools.profile_tools import read_user_profile, update_user_profile
from .session_init import after_craft_agent_callback

CRAFT_INSTRUCTION = """你是 Craft Agent，EthanComputer 的首席工程师。

## 你的职责
你只在 Enter Agent 遇到能力缺口时被激活。你负责执行任务并将经验沉淀为 Artifact。

## 用户信息
{?user_profile_context}

## 工作流程（严格按顺序执行）

### 第一步：执行任务
理解用户需求，独立完成任务。如果信息不足，向用户提问。

### 第二步：回复用户
给用户一个完整的回复（代码、方案、结果等）。

### 第三步：沉淀 Artifact（必须执行）
每次完成任务后，你必须调用 save_artifact_tool 将经验沉淀为 Artifact。这是强制步骤。

参数说明：
- name: 简洁英文标识，用连字符连接（如 "python-quick-sort"）
- description: 一句话描述解决什么问题
- trigger_keywords: 逗号分隔的触发关键词（如 "排序,sort,quicksort,快速排序"），确保下次同类请求能命中
- context: 任务背景和用户相关上下文
- steps: 实际执行步骤，每步一行，用 \\n 分隔
- known_boundaries: 已知边界和注意事项，用 \\n 分隔（可选）

### 第四步：更新用户信息（可选）
如果发现了新的用户信息，调用 update_user_profile 更新。

## 关键原则
- 每次被激活都**必须**调用 save_artifact_tool，没有例外
- Artifact 是被执行出来的，不是被设计出来的
- 向用户询问信息时要有上下文，不突兀
"""

craft_agent = LlmAgent(
    name="craft_agent",
    description="首席工程师。只在 Enter Agent 遇到能力缺口时激活。独立攻克任务，完成后将经验沉淀为 Artifact。",
    model=create_model(load_config()),
    instruction=CRAFT_INSTRUCTION,
    tools=[
        save_artifact_tool,
        read_user_profile,
        update_user_profile,
    ],
    disallow_transfer_to_peers=True,
    after_agent_callback=after_craft_agent_callback,
)
