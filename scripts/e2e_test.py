"""EthanComputer 端到端测试脚本。

验证两条核心流程：
1. 学习通道：陌生任务 → Craft Agent 激活 → Artifact 创建
2. 高速通道：同类任务 → Enter Agent 检索匹配 → 直接回复

使用方式：python scripts/e2e_test.py
"""

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# 加载 .env
load_dotenv()

# 确保可以从项目根目录导入
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types


def print_event(event):
    """打印事件信息。"""
    if not event.content or not event.content.parts:
        return
    for part in event.content.parts:
        if part.text:
            print(f"  [{event.author}]: {part.text}")
        if part.function_call:
            args_str = ", ".join(f"{k}={v!r}" for k, v in (part.function_call.args or {}).items())
            print(f"  [{event.author} → tool]: {part.function_call.name}({args_str})")
        if part.function_response:
            resp = part.function_response.response
            if isinstance(resp, dict):
                status = resp.get("status", "?")
                print(f"  [tool → {event.author}]: {part.function_response.name} → {status}")
            else:
                print(f"  [tool → {event.author}]: {part.function_response.name} → done")


async def run_conversation(runner, session_service, app_name, user_id, messages):
    """运行多轮对话，返回所有事件。"""
    session = await session_service.create_session(
        app_name=app_name,
        user_id=user_id,
    )
    all_events = []
    for msg in messages:
        print(f"\n{'='*60}")
        print(f"[User]: {msg}")
        print(f"{'='*60}")
        content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=msg)],
        )
        turn_events = []
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session.id,
            new_message=content,
        ):
            print_event(event)
            turn_events.append(event)
        all_events.append(turn_events)
    return all_events, session


def check_artifact_created(artifacts_dir: Path) -> list[str]:
    """检查 artifacts 目录下的文件。"""
    if not artifacts_dir.exists():
        return []
    return [f.stem for f in artifacts_dir.glob("*.yaml")]


async def main():
    from agent import root_agent

    app_name = "ethan_computer"
    user_id = "ethan"
    data_dir = os.getenv("ETHAN_DATA_DIR", "./data")
    artifacts_dir = Path(data_dir) / "artifacts"

    # 清理之前的测试数据
    if artifacts_dir.exists():
        for f in artifacts_dir.glob("*.yaml"):
            f.unlink()
            print(f"(cleaned up: {f.name})")

    session_service = InMemorySessionService()
    runner = Runner(
        app_name=app_name,
        agent=root_agent,
        session_service=session_service,
    )

    print("=" * 60)
    print("EthanComputer 端到端测试")
    print(f"Model: {root_agent.model}")
    print("=" * 60)

    # ========================================
    # 测试 1：闲聊（不需要检索或转交）
    # ========================================
    print("\n" + "▼" * 60)
    print("测试 1：闲聊 — Enter Agent 直接回复")
    print("▼" * 60)
    await run_conversation(
        runner, session_service, app_name, user_id,
        ["你好"],
    )

    # ========================================
    # 测试 2：学习通道 — 陌生任务触发 Craft Agent
    # ========================================
    print("\n" + "▼" * 60)
    print("测试 2：学习通道 — 陌生任务 → Craft Agent → Artifact 创建")
    print("▼" * 60)
    learn_events, _ = await run_conversation(
        runner, session_service, app_name, user_id,
        ["帮我用 Python 写一个快速排序函数，要求支持自定义比较函数"],
    )

    # 检查 Artifact 是否创建
    artifacts = check_artifact_created(artifacts_dir)
    print(f"\n>>> Artifact 目录: {artifacts}")

    if artifacts:
        print(f">>> ✅ 学习通道成功：Artifact 已创建 ({len(artifacts)} 个)")
        # 打印 Artifact 内容
        for name in artifacts:
            artifact_path = artifacts_dir / f"{name}.yaml"
            print(f"\n--- Artifact: {name} ---")
            print(artifact_path.read_text(encoding="utf-8")[:500])
    else:
        print(">>> ⚠️ 学习通道：未检测到 Artifact 创建")
        print(">>> 检查上方事件流，确认 Craft Agent 是否被激活")

    # ========================================
    # 测试 3：高速通道 — 同类任务走 Enter Agent 直接回复
    # ========================================
    if artifacts:
        print("\n" + "▼" * 60)
        print("测试 3：高速通道 — 同类任务 → Enter Agent 检索匹配")
        print("▼" * 60)
        fast_events, _ = await run_conversation(
            runner, session_service, app_name, user_id,
            ["帮我写一个排序函数"],
        )

        # 检查是否有 transfer_to_agent 事件（不应该有）
        transferred = False
        for turn in fast_events:
            for event in turn:
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.function_call and "transfer" in (part.function_call.name or ""):
                            if "craft" in str(part.function_call.args or {}).lower():
                                transferred = True

        if transferred:
            print(">>> ⚠️ 高速通道：仍然转交给了 Craft Agent（Artifact 检索可能未命中）")
        else:
            print(">>> ✅ 高速通道：Enter Agent 直接处理（可能检索到了 Artifact）")
    else:
        print("\n>>> 跳过测试 3（需要先成功创建 Artifact）")

    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
