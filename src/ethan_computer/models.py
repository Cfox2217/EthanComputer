"""Model 工厂 — 根据配置创建 ADK 可用的 model 对象。

判断规则：模型名包含 / → LiteLLM（第三方），否则 → 原生 Gemini 字符串。

使用示例（环境变量）：
  Gemini:  ETHAN_MODEL="gemini-2.5-flash"
  GLM:     ETHAN_MODEL="openai/glm-4-flash"  ETHAN_MODEL_API_BASE="https://open.bigmodel.cn/api/paas/v4"
  OpenAI:  ETHAN_MODEL="openai/gpt-4o"
"""

import logging

from .config import Config

logger = logging.getLogger("ethan_computer.models")


def create_model(config: Config):
    """根据 Config 创建 ADK 可用的 model。

    Args:
        config: 项目配置。

    Returns:
        str（原生 Gemini 模型名）或 LiteLlm 实例（第三方模型）。
    """
    model_name = config.model_name

    if "/" not in model_name:
        logger.info("models: using native Gemini. model=%s", model_name)
        return model_name

    from google.adk.models.lite_llm import LiteLlm

    kwargs = {}
    if config.model_api_base:
        kwargs["api_base"] = config.model_api_base

    model = LiteLlm(model=model_name, **kwargs)
    logger.info(
        "models: using LiteLLM. model=%s, api_base=%s",
        model_name,
        config.model_api_base or "(default)",
    )
    return model
