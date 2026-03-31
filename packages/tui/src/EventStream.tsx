import React from "react";
import { Box, Text } from "ink";
import type { RunState } from "./events.js";

interface EventStreamProps {
  state: RunState;
}

export function EventStream({ state }: EventStreamProps) {
  const { phase, request, headersCount, streamingText, l0Action, l0Reason,
    l0ArtifactId, l1Skill, l1ToolCalls, l1ReportSummary,
    resumeHeadersCount, l0Reply, outcome, totalMs } = state;

  if (phase === "idle") {
    return (
      <Box paddingX={1}>
        <Text color="gray">输入请求后按 Enter 运行</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* ── Request ──────────────────────────────────── */}
      <Card title="Request" borderColor="white">
        <Text color="white">  {request}</Text>
      </Card>

      {/* ── L0 Decision ──────────────────────────────── */}
      <Card title="L0 · 决策" borderColor="cyan">
        <Text color="gray">  {headersCount} artifact headers loaded</Text>
        {streamingText && (phase === "l0-decision") && (
          <Box flexDirection="column">
            <Text color="gray">  LLM thinking…</Text>
            <Text color="gray">    {truncate(streamingText, 200)}</Text>
          </Box>
        )}
        {l0Action === "execute" && (
          <Text color="green">  ✓ EXECUTE → {l0ArtifactId}</Text>
        )}
        {l0Action === "escalate" && (
          <Box flexDirection="column">
            <Text color="yellow">  ⚡ ESCALATE</Text>
            <Text color="yellow">    {l0Reason}</Text>
          </Box>
        )}
      </Card>

      {/* ── L1 Craft ─────────────────────────────────── */}
      {l1Skill && (
        <Card title="L1 · CraftEngine" borderColor="yellow">
          <Text>  Skill: {l1Skill}</Text>
          {l1ToolCalls.map((tc, i) => (
            <Text key={i}>  [{tc.round}] {tc.tool}: {tc.summary} <Text color="green">✓</Text> <Text color="gray">{tc.ms}ms</Text></Text>
          ))}
          {l1ReportSummary && <Text>  📋 {l1ReportSummary}</Text>}
        </Card>
      )}

      {/* ── L0 Resume ────────────────────────────────── */}
      {resumeHeadersCount !== null && (
        <Card title="L0 · 恢复" borderColor="cyan">
          <Text color="gray">  Re-loaded {resumeHeadersCount} headers</Text>
          {phase === "l0-resume" && streamingText && (
            <Box flexDirection="column">
              <Text color="gray">  LLM thinking…</Text>
              <Text color="gray">    {truncate(streamingText, 200)}</Text>
            </Box>
          )}
        </Card>
      )}

      {/* ── L0 Reply ─────────────────────────────────── */}
      {l0Reply && (
        <Card title="L0 · 回复" borderColor="green">
          {l0Reply.split("\n").map((line, i) => (
            <Text key={i}>  {line}</Text>
          ))}
        </Card>
      )}

      {/* ── Result ───────────────────────────────────── */}
      {phase === "done" && (
        <Card title="Result" borderColor={outcome === "success" ? "green" : "yellow"}>
          <Text>  {outcome === "success" ? "✓" : "⚠"} {outcome} · {(totalMs / 1000).toFixed(1)}s</Text>
        </Card>
      )}
    </Box>
  );
}

// ── Card 组件 ──────────────────────────────────────────

interface CardProps {
  title: string;
  borderColor: string;
  children: React.ReactNode;
}

function Card({ title, borderColor, children }: CardProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={borderColor} paddingX={1} marginTop={1}>
      <Text bold color={borderColor}>{title}</Text>
      {children}
    </Box>
  );
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\n/g, " ");
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 3) + "...";
}
