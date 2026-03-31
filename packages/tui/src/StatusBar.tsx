import React from "react";
import { Box, Text } from "ink";
import type { Phase } from "./events.js";

const PHASE_INFO: Record<Phase, { label: string; color: string }> = {
  idle: { label: "Idle", color: "gray" },
  "l0-decision": { label: "L0·决策中", color: "cyan" },
  "l1-craft": { label: "L1·处理中", color: "yellow" },
  "l0-resume": { label: "L0·恢复中", color: "cyan" },
  done: { label: "完成", color: "green" },
};

interface StatusBarProps {
  phase: Phase;
  runId: string;
  elapsed: string;
}

export function StatusBar({ phase, runId, elapsed }: StatusBarProps) {
  const { label, color } = PHASE_INFO[phase];
  return (
    <Box paddingX={1}>
      <Text bold color="white">Ethan Debug Console</Text>
      <Text> ── </Text>
      <Text bold color={color}>{label}</Text>
      {phase !== "idle" && (
        <>
          <Text> </Text>
          <Text color="green">●</Text>
          <Text> </Text>
          <Text color="gray">{elapsed}s</Text>
          {runId && <Text color="gray"> | {runId}</Text>}
        </>
      )}
    </Box>
  );
}
