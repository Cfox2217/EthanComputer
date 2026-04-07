"""User Profile 数据结构与文件读写。

User Profile 是用户全局信息的唯一存储位置。
存储路径：data/profiles/{user_id}.yaml
"""

import logging
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field

logger = logging.getLogger("ethan_computer.user_profile")


class UserProfile(BaseModel):
    """用户全局信息。跨任务通用的事实，不在各 artifact 中重复。"""

    name: str = ""
    primary_language: str = "中文"
    tech_stack: list[str] = Field(default_factory=list)
    work_style: str = ""
    communication_preference: str = ""
    notes: list[str] = Field(default_factory=list)

    def is_empty(self) -> bool:
        """是否为空 profile（刚初始化，尚未采集信息）。"""
        return not self.name and not self.tech_stack and not self.work_style


def _profile_path(profiles_dir: Path, user_id: str) -> Path:
    return profiles_dir / f"{user_id}.yaml"


def load_profile(profiles_dir: Path, user_id: str) -> UserProfile:
    """从文件加载 User Profile。文件不存在时返回空 Profile。"""
    path = _profile_path(profiles_dir, user_id)
    if not path.exists():
        logger.info("user_profile.load: profile not found, returning empty. user=%s", user_id)
        return UserProfile()
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    profile = UserProfile.model_validate(data)
    logger.info("user_profile.load: loaded. user=%s, name=%s", user_id, profile.name)
    return profile


def save_profile(profiles_dir: Path, user_id: str, profile: UserProfile) -> None:
    """将 User Profile 写入文件。"""
    profiles_dir.mkdir(parents=True, exist_ok=True)
    path = _profile_path(profiles_dir, user_id)
    data = profile.model_dump(exclude_defaults=False)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
    logger.info(
        "user_profile.save: saved. user=%s, path=%s, fields=%s",
        user_id, path, list(data.keys()),
    )


def profile_to_instruction_context(profile: UserProfile) -> str:
    """将 Profile 转为可注入 Agent instruction 的文本。"""
    if profile.is_empty():
        return "（尚未采集用户信息）"
    lines = []
    if profile.name:
        lines.append(f"姓名：{profile.name}")
    if profile.primary_language:
        lines.append(f"主要语言：{profile.primary_language}")
    if profile.tech_stack:
        lines.append(f"技术栈：{' · '.join(profile.tech_stack)}")
    if profile.work_style:
        lines.append(f"工作风格：{profile.work_style}")
    if profile.communication_preference:
        lines.append(f"沟通偏好：{profile.communication_preference}")
    if profile.notes:
        lines.append("备注：")
        for note in profile.notes:
            lines.append(f"  - {note}")
    return "\n".join(lines)
