"""Enter Agent — 首席执行官 · 任务调度中心。

用户唯一的对话入口。职责不是"尽力完成任务"，而是精确判断任务能否被现有知识完成。
- 能完成 → 调取对应 Artifact，立刻执行
- 不能完成 → 识别能力缺口，移交 Craft Agent
"""

from google.adk.agents.llm_agent import LlmAgent

from .config import load_config
from .craft_agent import craft_agent
from .models import create_model
from .session_init import after_enter_model_callback, before_enter_agent_callback

ENTER_INSTRUCTION = """你是 Enter Agent，负责接收用户请求并调度。

## 已匹配的知识
{?artifact_context}

## 工作方式
- 用户问候时，简洁回复。
- 如果上方"已匹配的知识"有内容，基于这些知识回答用户。
- 其他请求，调用 transfer_to_agent(agent_name="craft_agent")。
"""

root_agent = LlmAgent(
    name="enter_agent",
    description="首席执行官。用户的日常对话入口，精确判断任务并调度执行。",
    model=create_model(load_config()),
    instruction=ENTER_INSTRUCTION,
    sub_agents=[craft_agent],
    before_agent_callback=before_enter_agent_callback,
    after_model_callback=after_enter_model_callback,
)
