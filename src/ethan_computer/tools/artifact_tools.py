"""Artifact 读写工具，供 Agent 使用。"""

import json
from pathlib import Path

from ..artifact_library import Artifact, save_artifact, search_artifacts, load_artifact


def _get_artifacts_dir(tool_context) -> Path:
    data_dir = tool_context.state.get("data_dir", "./data")
    return Path(data_dir) / "artifacts"


def search_artifact_tool(query: str, *, tool_context) -> dict:
    """根据用户查询搜索匹配的 Artifact。

    当用户的请求可能匹配已有知识时，使用此工具检索。

    Args:
        query: 用户的原始请求文本。

    Returns:
        匹配到的 artifact 列表，或空列表。
    """
    artifacts_dir = _get_artifacts_dir(tool_context)
    matched = search_artifacts(artifacts_dir, query)
    if not matched:
        return {"status": "no_match", "artifacts": []}
    return {
        "status": "matched",
        "artifacts": [a.model_dump() for a in matched],
    }


def save_artifact_tool(
    name: str,
    description: str,
    trigger_keywords: str,
    context: str,
    steps: str,
    known_boundaries: str = "",
    *,
    tool_context,
) -> dict:
    """创建或更新一个 Artifact。

    Artifact 是经过真实执行验证的任务执行上下文。

    Args:
        name: artifact 名称，简洁标识（如 "deploy-fastapi-gcp"）。
        description: 一句话描述此 artifact 解决什么问题。
        trigger_keywords: 触发关键词，用逗号分隔（如 "部署,deploy,fastapi"）。
        context: 执行上下文——用户的个人上下文和任务背景。
        steps: 执行步骤，用换行分隔，每步一行。
        known_boundaries: 已知边界和注意事项，用换行分隔（可选）。
    """
    artifacts_dir = _get_artifacts_dir(tool_context)
    artifact = Artifact(
        name=name,
        description=description,
        trigger_keywords=[k.strip() for k in trigger_keywords.split(",")],
        context=context,
        steps=[s.strip() for s in steps.split("\n") if s.strip()],
        known_boundaries=[
            b.strip() for b in known_boundaries.split("\n") if b.strip()
        ] if known_boundaries else [],
    )
    save_artifact(artifacts_dir, artifact)
    return {"status": "success", "artifact": artifact.model_dump()}
