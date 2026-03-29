---
name: artifact-dev-task-breakdown-ethan
description: Ethan 专属的任务拆解执行面。当需要把需求拆成开发任务或输出实现计划时使用。
metadata:
  derived_from: dev-task-breakdown
  version: "0.1.0"
---

# Ethan task breakdown

## When to use

- 把需求拆成开发任务
- 输出实现计划

## Escalate when

- 请求涉及未定义协议
- 当前请求跨越不清晰模块边界

## User facts

- project_style: protocol-first
- preferred_output: markdown

## Execution

1. 识别目标
2. 识别影响边界
3. 拆成 1~3 天粒度任务
4. 输出按顺序排列的任务列表

## Escalate when (body)

- 缺少必要上下文
- 当前请求需要新的核心协议
