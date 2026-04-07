"""User Profile 读写工具，供 Craft Agent 使用。"""

from pathlib import Path

from ..user_profile import UserProfile, load_profile, save_profile


def _get_profiles_dir(tool_context) -> Path:
    """从 session state 或默认值获取 profiles 目录。"""
    data_dir = tool_context.state.get("data_dir", "./data")
    return Path(data_dir) / "profiles"


def read_user_profile(tool_context) -> dict:
    """读取当前用户的 Profile。

    Returns:
        包含用户信息的字典。
    """
    user_id = tool_context.state.get("user_id", "ethan")
    profiles_dir = _get_profiles_dir(tool_context)
    profile = load_profile(profiles_dir, user_id)
    return profile.model_dump()


def update_user_profile(
    name: str | None = None,
    primary_language: str | None = None,
    tech_stack: str | None = None,
    work_style: str | None = None,
    communication_preference: str | None = None,
    note: str | None = None,
    *,
    tool_context,
) -> dict:
    """更新用户 Profile 中的字段。

    Args:
        name: 用户姓名。
        primary_language: 主要使用语言。
        tech_stack: 技术栈，用逗号分隔（如 "Python, GCP, FastAPI"）。
        work_style: 工作风格描述。
        communication_preference: 沟通偏好。
        note: 追加一条备注。
    """
    user_id = tool_context.state.get("user_id", "ethan")
    profiles_dir = _get_profiles_dir(tool_context)
    profile = load_profile(profiles_dir, user_id)

    if name is not None:
        profile.name = name
    if primary_language is not None:
        profile.primary_language = primary_language
    if tech_stack is not None:
        profile.tech_stack = [s.strip() for s in tech_stack.split(",")]
    if work_style is not None:
        profile.work_style = work_style
    if communication_preference is not None:
        profile.communication_preference = communication_preference
    if note is not None:
        profile.notes.append(note)

    save_profile(profiles_dir, user_id, profile)
    return {"status": "success", "profile": profile.model_dump()}
