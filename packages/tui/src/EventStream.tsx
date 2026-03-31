import React from "react";
import { Box, Text } from "ink";
import type { RunState } from "./events.js";

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

// ── 单次运行的所有卡片 ────────────────────────────────

function RunCards({ state }: { state: RunState }) {
  const {
    phase, request, headersCount, streamingText,
    l0ToolCalls, l0Reply,
    l1Skill, l1ToolCalls, l1ReportSummary,
    resumeHeadersCount,
    outcome, totalMs, startTime,
    l1StartAt, l1EndAt, l0ResumeAt, l0ReplyAt,
  } = state;

  const isActive = phase !== "done" && phase !== "idle";

  return (
    <Box flexDirection="column">

      {/* Request */}
      <Box>
        <Text color="green" bold>{">"} </Text>
        <Text color="white">{request}</Text>
      </Box>

      {/* L0 Agent */}
      <SectionHeader
        icon="◆" label="L0 · Agent" color="cyan"
        stats={statLine(
          l0ReplyAt ? l0ReplyAt - startTime : (startTime && isActive ? Date.now() - startTime : null),
          l0ToolCalls.length,
        )}
      />
      <Box flexDirection="column" marginLeft={4}>
        <Text color="gray">{headersCount} headers loaded</Text>
        {l0ToolCalls.map((tc, i) => (
          <Text key={i}>
            <Text color="yellow">⚡</Text> {tc.tool}: {tc.summary}{" "}
            <Text color="gray">{tc.ms}ms</Text>
          </Text>
        ))}
        {streamingText && isActive && phase !== "l1-craft" && (
          <Text color="gray">thinking… {truncate(streamingText, 120)}</Text>
        )}
      </Box>

      {/* L1 Craft */}
      {l1Skill && (
        <>
          <SectionHeader
            icon="◆" label="L1 · Craft" color="yellow"
            stats={statLine(
              l1StartAt && l1EndAt ? l1EndAt - l1StartAt : null,
              l1ToolCalls.length,
            )}
          />
          <Box flexDirection="column" marginLeft={4}>
            <Text>Skill: {l1Skill}</Text>
            {l1ToolCalls.map((tc, i) => (
              <Text key={i}>
                [{tc.round}] {tc.tool}: {tc.summary}{" "}
                <Text color="green">✓</Text>{" "}
                <Text color="gray">{tc.ms}ms</Text>
              </Text>
            ))}
            {l1ReportSummary && <Text>📋 {l1ReportSummary}</Text>}
          </Box>
        </>
      )}

      {/* L0 恢复阶段 */}
      {l0ResumeAt !== null && (
        <>
          <SectionHeader
            icon="◆" label="L0 · 恢复执行" color="cyan"
            stats={statLine(l0ResumeAt && l0ReplyAt ? l0ReplyAt - l0ResumeAt : null)}
          />
          <Box flexDirection="column" marginLeft={4}>
            <Text color="gray">Re-loaded {resumeHeadersCount} headers, continuing…</Text>
            {streamingText && phase === "l0-resume" && (
              <Text color="gray">thinking… {truncate(streamingText, 120)}</Text>
            )}
          </Box>
        </>
      )}

      {/* L0 回复 */}
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

      {/* Result */}
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

// ── Section Header（替代 Card）──────────────────────────────

interface SectionHeaderProps {
  icon: string;
  label: string;
  color: string;
  stats?: string;
}

function SectionHeader({ icon, label, color, stats }: SectionHeaderProps) {
  return (
    <Box>
      <Text>  </Text>
      <Text color={color}>{icon} </Text>
      <Text bold color={color}>{label}</Text>
      {stats && <Text color="gray"> ── {stats}</Text>}
    </Box>
  );
}

// ── 工具函数 ────────────────────────────────────────────

function statLine(ms: number | null, toolCalls?: number): string {
  const parts: string[] = [];
  if (ms !== null) parts.push(`${(ms / 1000).toFixed(1)}s`);
  if (toolCalls !== undefined && toolCalls > 0) parts.push(`${toolCalls} tools`);
  return parts.join(" · ");
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\n/g, " ");
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 3) + "...";
}
