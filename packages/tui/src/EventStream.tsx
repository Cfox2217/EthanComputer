import React from "react";
import { Box, Text } from "ink";
import type { RunState } from "./events.js";

interface EventStreamProps {
  runs: RunState[];
}

export function EventStream({ runs }: EventStreamProps) {
  if (runs.length === 0) {
    return (
      <Box flexDirection="column" paddingY={6}>
        <Text color="gray">  输入请求后按 Enter 运行</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {runs.map((run, i) => (
        <React.Fragment key={run.runId || i}>
          {i > 0 && <Text color="gray">{"─".repeat(60)}</Text>}
          <RunCards state={run} />
        </React.Fragment>
      ))}
    </Box>
  );
}

// ── 单次运行的所有卡片 ────────────────────────────────

function RunCards({ state }: { state: RunState }) {
  const { phase, request, headersCount, streamingText, l0Action, l0Reason,
    l0ArtifactId, l1Skill, l1ToolCalls, l1ReportSummary,
    resumeHeadersCount, l0Reply, outcome, totalMs, startTime,
    l0DecisionAt, l1StartAt, l1EndAt, l0ResumeAt, l0ResumeDecisionAt } = state;

  return (
    <Box flexDirection="column">
      {/* Request */}
      <Card title="Request" color="white">
        <Text color="white">  {request}</Text>
      </Card>

      {/* L0 决策 */}
      <Card title="L0 · 决策" color="cyan" stats={formatMs(l0DecisionAt && startTime ? l0DecisionAt - startTime : null)}>
        <Text color="gray">  {headersCount} headers loaded</Text>
        {streamingText && phase === "l0-decision" && (
          <Text color="gray">  thinking… {truncate(streamingText, 120)}</Text>
        )}
        {l0Action === "execute" && (
          <Text color="green">  ✓ EXECUTE → {l0ArtifactId}</Text>
        )}
        {l0Action === "escalate" && (
          <Box flexDirection="column">
            <Text color="yellow">  ⚡ ESCALATE</Text>
            <Text color="yellow">  {l0Reason}</Text>
          </Box>
        )}
      </Card>

      {/* L1 Craft */}
      {l1Skill && (
        <Card title="L1 · Craft" color="yellow"
          stats={formatMs(l1StartAt && l1EndAt ? l1EndAt - l1StartAt : null, l1ToolCalls.length)}>
          <Text>  Skill: {l1Skill}</Text>
          {l1ToolCalls.map((tc, i) => (
            <Text key={i}>  [{tc.round}] {tc.tool}: {tc.summary} <Text color="green">✓</Text> <Text color="gray">{tc.ms}ms</Text></Text>
          ))}
          {l1ReportSummary && <Text>  📋 {l1ReportSummary}</Text>}
        </Card>
      )}

      {/* L0 恢复 */}
      {l0ResumeAt !== null && (
        <Card title="L0 · 恢复" color="cyan"
          stats={formatMs(l0ResumeAt && l0ResumeDecisionAt ? l0ResumeDecisionAt - l0ResumeAt : null)}>
          <Text color="gray">  Re-loaded {resumeHeadersCount} headers</Text>
          {phase === "l0-resume" && streamingText && (
            <Text color="gray">  thinking… {truncate(streamingText, 120)}</Text>
          )}
        </Card>
      )}

      {/* L0 回复 */}
      {l0Reply && (
        <Card title="L0 · 回复" color="green">
          {l0Reply.split("\n").map((line, i) => (
            <Text key={i}>  {line}</Text>
          ))}
        </Card>
      )}

      {/* Result */}
      {phase === "done" && (
        <Card title="Result" color={outcome === "success" ? "green" : "yellow"}>
          <Text>  {outcome === "success" ? "✓" : "⚠"} {outcome} · {(totalMs / 1000).toFixed(1)}s</Text>
        </Card>
      )}
    </Box>
  );
}

// ── Card 组件（紧凑边框） ──────────────────────────────

interface CardProps {
  title: string;
  color: string;
  stats?: string;
  children: React.ReactNode;
}

function Card({ title, color, stats, children }: CardProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={color} paddingX={1}>
      <Box>
        <Text bold color={color}>{title}</Text>
        {stats && <Text color="gray"> ── {stats}</Text>}
      </Box>
      {children}
    </Box>
  );
}

// ── 工具函数 ───────────────────────────────────────────

function formatMs(ms: number | null, toolCalls?: number): string {
  const parts: string[] = [];
  if (ms !== null) parts.push(`${(ms / 1000).toFixed(1)}s`);
  if (toolCalls !== undefined) parts.push(`${toolCalls} tools`);
  parts.push("-- tokens");
  return parts.join(" · ");
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\n/g, " ");
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 3) + "...";
}
