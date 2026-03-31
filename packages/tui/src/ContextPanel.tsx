import React from "react";
import { Box, Text } from "ink";
import type { RunState } from "./events.js";

export interface ArtifactHeaderBrief {
  title: string;
  when_to_use: string[];
  derived_from: string;
}

interface ContextPanelProps {
  state: RunState;
  headers: ArtifactHeaderBrief[];
}

export function ContextPanel({ state, headers }: ContextPanelProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="white">Artifact Headers ({headers.length})</Text>
      <Box marginTop={1} />
      {headers.map((h) => (
        <Box key={h.title} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginBottom={1}>
          <Text bold color="cyan">{h.title}</Text>
          <Text color="gray">  when: {h.when_to_use.join("、")}</Text>
          <Text color="gray">  from: {h.derived_from}</Text>
        </Box>
      ))}

      {state.phase !== "idle" && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="white">Run Stats</Text>
          <Text>  Duration: {(state.totalMs > 0 ? state.totalMs / 1000 : 0).toFixed(1)}s</Text>
          <Text>  Tool calls: {state.l1ToolCalls.length}</Text>
          {state.l1Skill && <Text>  Skill: {state.l1Skill}</Text>}
          {state.outcome && <Text>  Outcome: {state.outcome}</Text>}
        </Box>
      )}
    </Box>
  );
}
