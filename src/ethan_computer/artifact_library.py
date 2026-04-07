"""Artifact Library — 经过验证的执行上下文存储与检索。

Artifact 不是模板，不是文档，是经过 Craft Agent 跑通验证的、自包含的任务执行上下文。
存储路径：data/artifacts/{artifact_name}.yaml
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

import yaml
from pydantic import BaseModel, Field

logger = logging.getLogger("ethan_computer.artifact_library")


class Artifact(BaseModel):
    """一个经过验证的执行上下文。"""

    name: str
    description: str = ""
    trigger_keywords: list[str] = Field(default_factory=list)
    context: str = ""
    steps: list[str] = Field(default_factory=list)
    known_boundaries: list[str] = Field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""

    def match_query(self, query: str) -> bool:
        """判断用户查询是否匹配此 artifact（关键词匹配）。"""
        query_lower = query.lower()
        for keyword in self.trigger_keywords:
            if keyword.lower() in query_lower:
                return True
        if self.name.lower() in query_lower:
            return True
        return False


def _artifact_path(artifacts_dir: Path, name: str) -> Path:
    safe_name = name.replace("/", "_").replace(" ", "_")
    return artifacts_dir / f"{safe_name}.yaml"


def save_artifact(artifacts_dir: Path, artifact: Artifact) -> None:
    """将 Artifact 写入文件。"""
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    now = datetime.now().isoformat()
    if not artifact.created_at:
        artifact.created_at = now
    artifact.updated_at = now
    path = _artifact_path(artifacts_dir, artifact.name)
    data = artifact.model_dump(exclude_defaults=False)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False)
    logger.info(
        "artifact_library.save: name=%s, keywords=%s, path=%s",
        artifact.name, artifact.trigger_keywords, path,
    )


def load_artifact(artifacts_dir: Path, name: str) -> Optional[Artifact]:
    """按名称加载单个 Artifact。"""
    path = _artifact_path(artifacts_dir, name)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return Artifact.model_validate(data)


def list_artifacts(artifacts_dir: Path) -> list[Artifact]:
    """列出所有已存储的 Artifact。"""
    if not artifacts_dir.exists():
        return []
    artifacts = []
    for path in artifacts_dir.glob("*.yaml"):
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        try:
            artifacts.append(Artifact.model_validate(data))
        except Exception as e:
            logger.warning("artifact_library.list: skip invalid file %s: %s", path, e)
    return artifacts


def search_artifacts(artifacts_dir: Path, query: str) -> list[Artifact]:
    """根据用户查询检索匹配的 Artifact。"""
    all_artifacts = list_artifacts(artifacts_dir)
    matched = [a for a in all_artifacts if a.match_query(query)]
    logger.info(
        "artifact_library.search: query='%s', total=%d, matched=%d",
        query, len(all_artifacts), len(matched),
    )
    return matched


def delete_artifact(artifacts_dir: Path, name: str) -> bool:
    """删除指定 Artifact。"""
    path = _artifact_path(artifacts_dir, name)
    if path.exists():
        path.unlink()
        logger.info("artifact_library.delete: name=%s", name)
        return True
    return False
