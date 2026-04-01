/**
 * EventStream — 主显示区
 *
 * 核心原则：agent 的每轮推理文本完整显示，不截断，不消失。
 * 按 round 分组：推理文本 → 工具调用 → 下一轮。
 */

import React from "react";
import { Box, Text } from "ink";
import type { RunState, ReasoningStep, ToolCallRecord } from "./events.js";

// ── 入口 ──────────────────────────────────────────────────

interface EventStreamProps {
  runs: RunState[];
}

export function EventStream({ runs }: EventStreamProps) {
  if (runs.length === 0) {
    return (
      <Box flexDirection="column" paddingY={4}>
        <Text color="gray">  ⏎ 输入你的请求，按 Enter 开始运行</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {runs.map((run, i) => (
        <React.Fragment key={run.runId || i}>
          {i > 0 && (
            <Box marginY={1}>
              <Text color="gray">{"╌".repeat(76)}</Text>
            </Box>
          )}
          <RunCards state={run} />
        </React.Fragment>
      ))}
    </Box>
  );
}

// ── 单次运行 ──────────────────────────────────────────────

function RunCards({ state }: { state: RunState }) {
  const {
    phase, request, headersCount,
    l0ReasoningSteps, streamingText,
    l0ToolCalls, l0Reply,
    l1Skill, l1ReasoningSteps, l1StreamingText, l1ToolCalls,
    craftResult,
    resumeHeadersCount, l0ResumeStreamingText,
    outcome, totalMs, startTime,
    l1StartAt, l1EndAt, l0ResumeAt, l0ReplyAt,
  } = state;

  const isActive = phase !== "done" && phase !== "idle";

  return (
    <Box flexDirection="column">

      {/* ── 请求 ──────────────────────────────────────── */}
      <Box>
        <Text color="green" bold>{">"} </Text>
        <Text color="white">{request}</Text>
      </Box>

      {/* ── L0 Agent ──────────────────────────────────── */}
      <SectionHeader
        icon="◆" label="L0 · Agent" color="cyan"
        stats={formatDuration(
          l1StartAt
            ? l1StartAt - startTime                          // 已转交 L1 → 计时到转交点
            : l0ReplyAt
              ? l0ReplyAt - startTime                        // 未转交，已结束
              : (startTime && isActive ? Date.now() - startTime : null),  // 进行中
          l0ToolCalls.length,
        )}
      />
      <Box flexDirection="column" marginLeft={4}>
        <Text color="gray">{headersCount} headers loaded</Text>

        {/* 已完成轮次的推理 + 工具调用，按 round 分组 */}
        <AgentRounds reasoningSteps={l0ReasoningSteps} toolCalls={l0ToolCalls} />

        {/* 当前轮次的实时流式文本 */}
        {streamingText && isActive && (
          <Box flexDirection="column" marginTop={1}>
            <Text color="cyan">▸ </Text>
            {streamingText.split("\n").map((line, i) => (
              <Text key={i} color="white">{line}</Text>
            ))}
          </Box>
        )}
      </Box>

      {/* ── L1 Craft ─────────────────────────────────── */}
      {l1Skill && (
        <>
          <SectionHeader
            icon="◆" label="L1 · Craft" color="yellow"
            stats={[
              `Skill: ${l1Skill}`,
              formatDuration(
                l1StartAt && l1EndAt ? l1EndAt - l1StartAt : (l1StartAt && isActive ? Date.now() - l1StartAt : null),
                l1ToolCalls.length,
              ),
            ].join(" │ ")}
          />
          <Box flexDirection="column" marginLeft={4}>
            {/* 已完成轮次的推理 + 工具调用 */}
            <AgentRounds reasoningSteps={l1ReasoningSteps} toolCalls={l1ToolCalls} />

            {/* 当前轮次的实时流式文本 */}
            {l1StreamingText && isActive && phase === "l1-craft" && (
              <Box flexDirection="column" marginTop={1}>
                {l1StreamingText.split("\n").map((line, i) => (
                  <Box key={i}>
                    <Text color="yellow">▸ </Text>
                    <Text color="white">{line}</Text>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </>
      )}

      {/* ── L1 成果 ──────────────────────────────────── */}
      {craftResult && (
        <>
          <SectionHeader icon="◈" label="L1 · 成果" color="green" />
          <Box flexDirection="column" marginLeft={4}>
            <Box>
              <Text color="green">✓ </Text>
              <Text bold color="white">{craftResult.summary}</Text>
              <Text color="gray"> → </Text>
              <Text color="cyan">{craftResult.artifact_path.split("/").pop()}</Text>
            </Box>
            {craftResult.continue_hint && (
              <Box>
                <Text color="yellow">→ </Text>
                <Text color="white">{craftResult.continue_hint}</Text>
              </Box>
            )}
          </Box>
        </>
      )}

      {/* ── L0 恢复阶段 ─────────────────────────────── */}
      {l0ResumeAt !== null && (
        <>
          <SectionHeader
            icon="◆" label="L0 · 恢复执行" color="cyan"
            stats={formatDuration(
              l0ResumeAt && l0ReplyAt ? l0ReplyAt - l0ResumeAt : (l0ResumeAt && isActive ? Date.now() - l0ResumeAt : null),
            )}
          />
          <Box flexDirection="column" marginLeft={4}>
            <Text color="gray">Re-loaded {resumeHeadersCount} headers, continuing…</Text>

            {/* 当前轮次的实时流式文本 */}
            {l0ResumeStreamingText && isActive && (
              <Box flexDirection="column" marginTop={1}>
                {l0ResumeStreamingText.split("\n").map((line, i) => (
                  <Text key={i} color="white">{line}</Text>
                ))}
              </Box>
            )}
          </Box>
        </>
      )}

      {/* ── 回复（仅确认后显示）────────────────────────── */}
      {l0Reply && (
        <>
          <SectionHeader icon="◉" label="回复" color="green" />
          <Box flexDirection="column" marginLeft={4}>
            {l0Reply.split("\n").map((line, i) => (
              <Text key={i}>{line}</Text>
            ))}
          </Box>
        </>
      )}

      {/* ── 结果 ─────────────────────────────────────── */}
      {phase === "done" && (
        <Box marginTop={1}>
          <Text color={outcome === "success" ? "green" : "yellow"}>
            {outcome === "success" ? "✓" : "⚠"} {outcome} · {(totalMs / 1000).toFixed(1)}s
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ── Agent Rounds（按 round 分组展示推理 + 工具调用）──────────

function AgentRounds({ reasoningSteps, toolCalls }: {
  reasoningSteps: ReasoningStep[];
  toolCalls: ToolCallRecord[];
}) {
  if (reasoningSteps.length === 0 && toolCalls.length === 0) return null;

  // 合并 reasoning 和 tool calls，按 round 分组
  const rounds = new Map<number, { reasoning?: string; toolCalls: ToolCallRecord[] }>();

  for (const step of reasoningSteps) {
    const r = rounds.get(step.round) || { toolCalls: [] };
    r.reasoning = step.text;
    rounds.set(step.round, r);
  }

  for (const tc of toolCalls) {
    const round = tc.round || 1;
    const r = rounds.get(round) || { toolCalls: [] };
    r.toolCalls.push(tc);
    rounds.set(round, r);
  }

  const sorted = [...rounds.entries()].sort(([a], [b]) => a - b);

  return (
    <Box flexDirection="column">
      {sorted.map(([roundNum, data]) => (
        <Box key={roundNum} flexDirection="column" marginTop={1}>
          {data.reasoning && (
            <Box flexDirection="column" marginLeft={1}>
              {data.reasoning.split("\n").map((line, i) => (
                <Text key={i} color="white">
                  {i === 0 ? `[${roundNum}] ` : "    "}
                  {line}
                </Text>
              ))}
            </Box>
          )}
          {data.toolCalls.map((tc, i) => (
            <ToolCallItem key={i} tool={tc.tool} summary={tc.summary} ms={tc.ms} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ── Tool Call Item（中等视觉权重）──────────────────────────

function ToolCallItem({ tool, summary, ms }: {
  tool: string;
  summary: string;
  ms: number;
}) {
  return (
    <Box>
      <Text color="yellow">⚡ </Text>
      <Text bold color="white">{tool}</Text>
      <Text>: </Text>
      <Text>{summary}</Text>
      <Text color="green"> ✓</Text>
      <Text color="gray"> {ms}ms</Text>
    </Box>
  );
}

// ── Section Header ────────────────────────────────────────

interface SectionHeaderProps {
  icon: string;
  label: string;
  color: string;
  stats?: string;
}

function SectionHeader({ icon, label, color, stats }: SectionHeaderProps) {
  return (
    <Box marginTop={1}>
      <Text>  </Text>
      <Text color={color}>{icon} </Text>
      <Text bold color={color}>{label}</Text>
      {stats && <Text color="gray"> ── {stats}</Text>}
    </Box>
  );
}

// ── 工具函数 ───────────────────────────────────────────────

function formatDuration(ms: number | null, toolCalls?: number): string {
  const parts: string[] = [];
  if (ms !== null) parts.push(`${(ms / 1000).toFixed(1)}s`);
  if (toolCalls !== undefined && toolCalls > 0) parts.push(`${toolCalls} tools`);
  return parts.join(" · ");
}
