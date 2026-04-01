/**
 * EventStream — 主显示区
 *
 * 视觉层级：
 * - Section header (◆) : col 2，各阶段入口
 * - Section content    : col 6 (header col 2 + marginLeft 4)，推理/工具调用
 * - Reply (◉)          : col 2，与 section header 同级，紧贴其所属 section
 * - Result             : col 0，运行结束标记
 *
 * 间距规则：
 * - 大阶段之间（L0→L1, L1→Resume）：section header marginTop=1
 * - Reply 紧贴所属 section：无额外间距
 * - 同一阶段内的子块（L1 Craft → 成果）：无间距，视觉归组
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
  const l0HasContent = l0ReasoningSteps.length > 0 || l0ToolCalls.length > 0;

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
            ? l1StartAt - startTime
            : l0ReplyAt
              ? l0ReplyAt - startTime
              : (startTime && isActive ? Date.now() - startTime : null),
          l0ToolCalls.length,
        )}
      />
      <Box flexDirection="column" marginLeft={4}>
        <Text color="gray">{headersCount} headers loaded</Text>
        <AgentRounds reasoningSteps={l0ReasoningSteps} toolCalls={l0ToolCalls} />
      </Box>

      {/* L0 回复：紧贴 section，无间距 */}
      {!l0ResumeAt && (() => {
        const text = l0Reply || (streamingText && isActive ? streamingText : null);
        if (!text) return null;
        return <ReplyBlock text={text} />;
      })()}

      {/* ── L1 Craft + 成果（同一阶段，视觉归组）──────── */}
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
            <AgentRounds reasoningSteps={l1ReasoningSteps} toolCalls={l1ToolCalls} />

            {/* 流式文本 */}
            {l1StreamingText && isActive && phase === "l1-craft" && (
              <Box flexDirection="column" marginTop={l1ReasoningSteps.length > 0 || l1ToolCalls.length > 0 ? 1 : 0}>
                {l1StreamingText.split("\n").map((line, i) => (
                  <Text key={i}>{line}</Text>
                ))}
              </Box>
            )}

            {/* L1 成果（归入 L1 section，紧贴内容） */}
            {craftResult && (
              <Box flexDirection="column" marginTop={1}>
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
          </Box>

          {/* Resume 回复：紧贴 section */}
          {(() => {
            const text = l0Reply || (l0ResumeStreamingText && isActive ? l0ResumeStreamingText : null);
            if (!text) return null;
            return <ReplyBlock text={text} />;
          })()}
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

// ── Reply Block ────────────────────────────────────────────
// col 2 对齐 section header，无顶部间距（紧贴父 section）

function ReplyBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  if (lines.length === 0) return null;
  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Box>
        <Text color="green" bold>◉ </Text>
        <Text>{lines[0]}</Text>
      </Box>
      {lines.slice(1).map((line, i) => (
        <Box key={i} marginLeft={2}>
          <Text>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Agent Rounds ───────────────────────────────────────────
// 按 round 分组，推理文本 + 工具调用

function AgentRounds({ reasoningSteps, toolCalls }: {
  reasoningSteps: ReasoningStep[];
  toolCalls: ToolCallRecord[];
}) {
  if (reasoningSteps.length === 0 && toolCalls.length === 0) return null;

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
            <Box flexDirection="column">
              {data.reasoning.split("\n").map((line, i) => (
                <Text key={i} color="white">{line}</Text>
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

// ── Tool Call Item ─────────────────────────────────────────

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

// ── Section Header ─────────────────────────────────────────

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
