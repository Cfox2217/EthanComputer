"""Session state 初始化与请求路由。

职责：
1. before_agent_callback：初始化 session state + 检索 Artifact + 标记问候
2. after_model_callback：拦截 Enter Agent 的模型回复，当需要转交时强制注入 transfer_to_agent

为什么需要 after_model_callback：
GLM-4-flash 等 instruction following 较弱的模型不会主动调用 transfer_to_agent。
通过程序化拦截，确保非问候、无 Artifact 匹配的请求一定转交给 Craft Agent。
"""

import logging
from pathlib import Path

from google.adk.models.llm_response import LlmResponse
from google.genai import types

from .artifact_library import search_artifacts
from .config import load_config
from .user_profile import load_profile, profile_to_instruction_context

logger = logging.getLogger("ethan_computer.session_init")

_SENTINEL_KEY = "_session_initialized"


def _get_latest_user_text(callback_context) -> str:
    """从 session events 中提取用户最新的文本消息。"""
    invocation_ctx = getattr(callback_context, '_invocation_context', None)
    if not invocation_ctx or not invocation_ctx.session:
        return ""
    events = invocation_ctx.session.events
    if not events:
        return ""
    for event in reversed(events):
        if event.author == "user" and event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    return part.text
    return ""


def _detect_greeting(text: str) -> bool:
    """检测是否为纯问候。"""
    greetings = {"你好", "hello", "hi", "嗨", "hey", "谢谢", "感谢", "再见", "bye", "拜拜"}
    text_stripped = text.strip().lower()
    if text_stripped in greetings:
        return True
    # 很短的中文消息（< 6 字）可能是问候
    if len(text_stripped) < 6 and not any(kw in text_stripped for kw in ["帮", "写", "做", "怎么", "如何"]):
        return True
    return False


def _format_artifact_context(matched_artifacts) -> str:
    """将匹配的 Artifact 列表格式化为可注入 instruction 的文本。"""
    if not matched_artifacts:
        return ""
    lines = []
    for artifact in matched_artifacts:
        lines.append(f"### {artifact.name}")
        lines.append(f"描述：{artifact.description}")
        if artifact.context:
            lines.append(f"上下文：{artifact.context}")
        if artifact.steps:
            lines.append("步骤：")
            for i, step in enumerate(artifact.steps, 1):
                lines.append(f"  {i}. {step}")
        if artifact.known_boundaries:
            lines.append("注意事项：" + "; ".join(artifact.known_boundaries))
        lines.append("")
    return "\n".join(lines)


def _has_function_call(llm_response) -> bool:
    """检查 LlmResponse 是否包含 function call。"""
    if not llm_response.content or not llm_response.content.parts:
        return False
    return any(part.function_call for part in llm_response.content.parts)


def initialize_session_state(callback_context) -> None:
    """首次调用时从 Config 和 UserProfile 加载数据，注入 session state。"""
    if callback_context.state.get(_SENTINEL_KEY):
        return

    config = load_config()

    callback_context.state["user_id"] = config.user_id
    callback_context.state["data_dir"] = str(config.data_dir)

    profile = load_profile(config.profiles_dir, config.user_id)
    callback_context.state["user_profile_context"] = profile_to_instruction_context(profile)

    callback_context.state[_SENTINEL_KEY] = True

    logger.info(
        "session_init: initialized. user=%s, data_dir=%s, profile_empty=%s",
        config.user_id,
        config.data_dir,
        profile.is_empty(),
    )


def _search_and_inject_artifacts(callback_context) -> None:
    """从用户最新消息检索 Artifact，结果注入 artifact_context。"""
    config = load_config()
    artifacts_dir = Path(config.data_dir) / "artifacts"

    user_text = _get_latest_user_text(callback_context)
    if not user_text:
        callback_context.state["artifact_context"] = ""
        callback_context.state["_is_greeting"] = True
        return

    is_greeting = _detect_greeting(user_text)
    callback_context.state["_is_greeting"] = is_greeting

    if is_greeting:
        callback_context.state["artifact_context"] = ""
        return

    matched = search_artifacts(artifacts_dir, user_text)
    if matched:
        context_text = _format_artifact_context(matched)
        callback_context.state["artifact_context"] = context_text
        logger.info(
            "session_init: artifact matched. query='%s', count=%d",
            user_text[:50],
            len(matched),
        )
    else:
        callback_context.state["artifact_context"] = ""
        logger.debug("session_init: no artifact match for '%s'", user_text[:50])


def before_enter_agent_callback(callback_context) -> None:
    """Enter Agent 的 before_agent_callback。

    首次调用：初始化 session state（Config + UserProfile）。
    每次调用：检索 Artifact 并注入 instruction 模板，标记是否为问候。
    """
    try:
        initialize_session_state(callback_context)
    except Exception:
        logger.exception("session_init: failed to initialize session state.")

    try:
        _search_and_inject_artifacts(callback_context)
    except Exception:
        logger.exception("session_init: failed to search artifacts.")
        callback_context.state["artifact_context"] = ""
        callback_context.state["_is_greeting"] = True


def after_enter_model_callback(callback_context, llm_response):
    """Enter Agent 的 after_model_callback。

    拦截模型回复，在需要时强制注入 transfer_to_agent 调用。

    判断逻辑：
    - 模型已调用 function call（包括 transfer） → 放行
    - 有 Artifact 匹配（高速通道） → 放行
    - 是问候 → 放行
    - 其他（模型直接回答了任务请求） → 强制转交 craft_agent
    """
    # 模型已调用工具，放行
    if _has_function_call(llm_response):
        return None

    # 高速通道：有 Artifact 匹配，放行
    if callback_context.state.get("artifact_context"):
        logger.info("session_init: high-speed channel, letting model response through.")
        return None

    # 问候：放行
    if callback_context.state.get("_is_greeting"):
        return None

    # 非问候、无匹配、模型直接回答了 → 强制转交 craft_agent
    logger.info("session_init: forcing transfer to craft_agent (model answered directly).")
    return LlmResponse(
        content=types.Content(
            role="model",
            parts=[
                types.Part.from_function_call(
                    name="transfer_to_agent",
                    args={"agent_name": "craft_agent"},
                )
            ],
        )
    )


def _did_call_save_artifact(callback_context) -> bool:
    """检查当前 turn 中是否已调用过 save_artifact_tool。"""
    invocation_ctx = getattr(callback_context, '_invocation_context', None)
    if not invocation_ctx or not invocation_ctx.session:
        return False
    for event in reversed(invocation_ctx.session.events):
        if event.author == "user":
            break
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.function_call and part.function_call.name == "save_artifact_tool":
                    return True
    return False


def _get_craft_response_text(callback_context) -> str:
    """获取 Craft Agent 的回复文本。"""
    invocation_ctx = getattr(callback_context, '_invocation_context', None)
    if not invocation_ctx or not invocation_ctx.session:
        return ""
    texts = []
    for event in reversed(invocation_ctx.session.events):
        if event.author == "user":
            break
        if event.author == "craft_agent" and event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    texts.append(part.text)
    return "\n".join(reversed(texts))


def _extract_keywords(text: str) -> list[str]:
    """从用户消息中提取搜索关键词。

    提取 2 字中文窗口和英文单词，确保同类请求能命中。
    """
    import re
    keywords = set()
    # 提取中文段，生成 2 字窗口
    for segment in re.findall(r'[\u4e00-\u9fff]+', text):
        for i in range(len(segment) - 1):
            keywords.add(segment[i:i + 2])
        if len(segment) <= 4:
            keywords.add(segment)
    # 提取英文单词（>= 2 字符）
    for word in re.findall(r'[a-zA-Z]+', text):
        if len(word) >= 2:
            keywords.add(word.lower())
    return list(keywords)[:15]


def after_craft_agent_callback(callback_context) -> None:
    """Craft Agent 的 after_agent_callback。

    如果 Craft Agent 没有调用 save_artifact_tool，程序化保存一个基础 Artifact。
    """
    if _did_call_save_artifact(callback_context):
        logger.info("session_init: craft already saved artifact, skipping.")
        return

    user_text = _get_latest_user_text(callback_context)
    craft_response = _get_craft_response_text(callback_context)

    if not user_text or not craft_response:
        logger.warning("session_init: no user/craft text, skipping artifact save.")
        return

    config = load_config()
    artifacts_dir = Path(config.data_dir) / "artifacts"

    # 生成简单的 artifact name
    safe_name = user_text.strip()[:30].replace(" ", "-")
    safe_name = "".join(c for c in safe_name if c.isalnum() or c in "-_") or "untitled"

    from .artifact_library import Artifact, save_artifact
    artifact = Artifact(
        name=safe_name,
        description=f"用户请求：{user_text[:100]}",
        trigger_keywords=_extract_keywords(user_text),
        context=f"用户原始请求：{user_text}",
        steps=[f"基于已有知识回答了用户关于「{user_text[:50]}」的问题"],
        known_boundaries=["此 Artifact 由系统自动生成，步骤未经 Craft Agent 手动提炼"],
    )
    save_artifact(artifacts_dir, artifact)
    logger.info("session_init: auto-saved artifact '%s' after craft agent.", safe_name)
