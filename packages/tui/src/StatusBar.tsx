import React from "react";
import { Box, Text } from "ink";
import type { Phase } from "./events.js";

const PHASE_INFO: Record<Phase, { label: string; color: string }> = {
  idle: { label: "Ready", color: "gray" },
  "l0-thinking": { label: "L0·执行中", color: "cyan" },
  "l1-craft": { label: "L1·处理中", color: "yellow" },
  "l0-resume": { label: "L0·恢复中", color: "cyan" },
  done: { label: "Done", color: "green" },
};

interface StatusBarProps {
  phase: Phase;
  runId: string;
  totalRuns: number;
}

export function StatusBar({ phase, runId, totalRuns }: StatusBarProps) {
  const { label, color } = PHASE_INFO[phase];
  const isActive = phase !== "idle" && phase !== "done";

  return (
    <Box paddingX={1}>
      <Text bold color="white">Ethan Computer</Text>
      <Text> ── </Text>
      <Text bold color={color}>{label}</Text>
      {isActive && (
        <Text color={color}> ●</Text>
      )}
      {totalRuns > 0 && (
        <>
          <Text color="gray"> │ </Text>
          <Text color="gray">Run #{totalRuns}</Text>
        </>
      )}
    </Box>
  );
}
