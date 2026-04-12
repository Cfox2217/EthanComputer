"""EthanComputer 配置管理。"""

import os
from pathlib import Path

from pydantic import BaseModel


class Config(BaseModel):
    """项目全局配置。"""

    user_id: str = "ethan"
    data_dir: Path = Path("./data")
    model_name: str = "gemini-2.5-flash"
    model_api_base: str = ""

    @property
    def profiles_dir(self) -> Path:
        return self.data_dir / "profiles"

    @property
    def artifacts_dir(self) -> Path:
        return self.data_dir / "artifacts"


def load_config() -> Config:
    """从环境变量加载配置，提供合理默认值。"""
    data_dir = os.getenv("ETHAN_DATA_DIR", "./data")
    user_id = os.getenv("ETHAN_USER_ID", "ethan")
    model_name = os.getenv("ETHAN_MODEL_NAME", "gemini-2.5-flash")
    model_api_base = os.getenv("ETHAN_MODEL_API_BASE", "")
    return Config(
        user_id=user_id,
        data_dir=Path(data_dir),
        model_name=model_name,
        model_api_base=model_api_base,
    )
