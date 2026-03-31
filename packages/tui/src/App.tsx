import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import type { TuiEvent } from "@ethan-computer/protocol-types";
import { StatusBar } from "./StatusBar.js";
import { EventStream } from "./EventStream.js";
import { InputBar } from "./InputBar.js";
import {
  initialRunState,
  applyEvent,
  type RunState,
  type Phase,
} from "./events.js";

interface AppProps {
  onRun: (request: string) => Promise<void>;
  eventEmitter: (handler: (event: TuiEvent) => void) => void;
}

export function App({ onRun, eventEmitter }: AppProps) {
  const { exit } = useApp();
  const [runs, setRuns] = useState<RunState[]>([]);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState("0.0");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // 注册事件处理器：request 事件创建新 run，其他事件更新最后一个 run
  useEffect(() => {
    eventEmitter((event: TuiEvent) => {
      setRuns((prev) => {
        if (event.type === "request") {
          return [...prev, applyEvent(initialRunState(), event)];
        }
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = applyEvent(updated[updated.length - 1], event);
        return updated;
      });
    });
  }, [eventEmitter]);

  // 计时器
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRuns((prev) => {
        const current = prev[prev.length - 1];
        if (current && current.phase !== "idle" && current.phase !== "done" && current.startTime > 0) {
          setElapsed(((Date.now() - current.startTime) / 1000).toFixed(1));
        } else if (current && current.phase === "done") {
          setElapsed((current.totalMs / 1000).toFixed(1));
        }
        return prev;
      });
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const currentPhase: Phase = runs.length > 0 ? runs[runs.length - 1].phase : "idle";
  const currentRunId = runs.length > 0 ? runs[runs.length - 1].runId : "";

  const handleSubmit = useCallback(async (request: string) => {
    setRunning(true);
    try {
      await onRun(request);
    } finally {
      setRunning(false);
    }
  }, [onRun]);

  const handleQuit = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    exit();
  }, [exit]);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray">
      <StatusBar phase={currentPhase} runId={currentRunId} totalRuns={runs.length} />
      <Text color="gray">{"─".repeat(76)}</Text>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <EventStream runs={runs} />
      </Box>
      <Text color="gray">{"─".repeat(76)}</Text>
      <InputBar onSubmit={handleSubmit} onQuit={handleQuit} disabled={running} />
    </Box>
  );
}
