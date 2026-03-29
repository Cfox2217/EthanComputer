---
name: dev.task.breakdown
version: 0.1.0
description: 把自然语言需求拆成工程任务
scenarios:
  - feature-breakdown
  - architecture-breakdown
constraints:
  - 不发明未存在边界
---

# Break request into engineering tasks

把自然语言形式的需求拆解为可执行的工程任务列表。

## 适用场景

- **feature-breakdown**: 用户给出一个功能需求，需要拆成开发任务
- **architecture-breakdown**: 用户给出架构调整方向，需要拆成工程步骤

## 约束

- 不发明未存在的系统边界
- 不假设未定义的协议
- 任务粒度控制在 1~3 天

## 方法

1. 识别用户请求中的目标
2. 识别影响边界（哪些模块、哪些协议）
3. 按依赖顺序拆成工程任务
4. 输出按顺序排列的任务列表，每个任务包含：目标、涉及模块、验收标准
