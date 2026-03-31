import React from "react";
import { Box, Text } from "ink";
import type { RunState } from "./events.js";

interface EventStreamProps {
  state: RunState;
}

export function EventStream({ state }: EventStreamProps) {
  const { phase, request, headersCount, streamingText, l0Action, l0Reason,
    l0ArtifactId, l1Skill, l1ToolCalls, l1ReportSummary,
    resumeHeadersCount, outcome, totalMs, runId } = state;

  if (phase === "idle") {
    return (
      <Box paddingX={1}>
        <Text color="gray">输入请求后按 Enter 运行</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Request */}
      <Box flexDirection="column">
        <Text bold color="white">▸ Request</Text>
        <Text color="white">  &quot;{request}&quot;</Text>
      </Box>

      {/* L0 */}
      <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
        <Text bold color="cyan">L0</Text>
        <Text>  ◆ {headersCount} artifact headers loaded</Text>
        {streamingText && (phase === "l0-decision" || phase === "l0-resume") && (
          <Box flexDirection="column">
            <Text>  ◆ LLM streaming…</Text>
            <Text color="gray">    {truncate(streamingText, 120)}</Text>
          </Box>
        )}
        {l0Action === "execute" && (
          <Text color="green">  ✓ EXECUTE · artifact: {l0ArtifactId}</Text>
        )}
        {l0Action === "escalate" && (
          <Box flexDirection="column">
            <Text color="yellow">  ⚡ ESCALATE</Text>
            <Text color="yellow">    {l0Reason}</Text>
          </Box>
        )}
      </Box>

      {/* L1 */}
      {l1Skill && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
          <Text bold color="yellow">L1 CraftEngine</Text>
          <Text>  ◆ Skill: {l1Skill}</Text>
          {l1ToolCalls.map((tc, i) => (
            <Text key={i}>  [{tc.round}] {tc.summary} <Text color="green">✓</Text> <Text color="gray">{tc.ms}ms</Text></Text>
          ))}
          {l1ReportSummary && <Text>  📋 {l1ReportSummary}</Text>}
        </Box>
      )}

      {/* L0 Resume */}
      {resumeHeadersCount !== null && (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginTop={1}>
          <Text bold color="cyan">L0 Resume</Text>
          <Text>  ◆ Re-loaded {resumeHeadersCount} headers</Text>
          {phase === "l0-resume" && streamingText && (
            <Box flexDirection="column">
              <Text>  ◆ LLM streaming…</Text>
              <Text color="gray">    {truncate(streamingText, 120)}</Text>
            </Box>
          )}
          {phase === "done" && l0Action === "execute" && (
            <Text color="green">  ✓ EXECUTE · {l0ArtifactId}</Text>
          )}
          {phase === "done" && l0Action === "escalate" && (
            <Text color="yellow">  ⚡ ESCALATE · {l0Reason}</Text>
          )}
        </Box>
      )}

      {/* Done */}
      {phase === "done" && (
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1} marginTop={1}>
          <Text bold color="green">Done</Text>
          <Text>  {outcome === "success" ? "✓" : "⚠"} {outcome} · {(totalMs / 1000).toFixed(1)}s · {runId}</Text>
        </Box>
      )}
    </Box>
  );
}

function truncate(text: string, max: number): string {
  const cleaned = text.replace(/\n/g, " ");
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 3) + "...";
}
