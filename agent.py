"""EthanComputer ADK 入口。

ADK CLI (adk run / adk web) 会查找此文件中的 root_agent。
"""

from ethan_computer.agent import root_agent

__all__ = ["root_agent"]
