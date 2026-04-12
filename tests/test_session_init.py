"""Session state 初始化测试。"""

from unittest.mock import MagicMock

from ethan_computer.session_init import initialize_session_state, _SENTINEL_KEY


def test_initializes_state():
    """首次调用时正确注入 user_id, data_dir, user_profile_context 和 sentinel。"""
    state = {}
    ctx = MagicMock()
    ctx.state = state

    initialize_session_state(ctx)

    assert state["user_id"] == "ethan"
    assert "data" in state["data_dir"]
    assert isinstance(state["user_profile_context"], str)
    assert state[_SENTINEL_KEY] is True


def test_idempotent():
    """sentinel 已设置时跳过初始化。"""
    sentinel_state = {_SENTINEL_KEY: True, "user_id": "existing"}
    ctx = MagicMock()
    ctx.state = sentinel_state

    initialize_session_state(ctx)

    assert sentinel_state["user_id"] == "existing"


def test_profile_empty_when_no_file():
    """无 profile 文件时注入"尚未采集用户信息"提示。"""
    state = {}
    ctx = MagicMock()
    ctx.state = state

    initialize_session_state(ctx)

    assert "尚未采集" in state["user_profile_context"]
