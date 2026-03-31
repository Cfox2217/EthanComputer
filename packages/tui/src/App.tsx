import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import type { TuiEvent } from "@ethan-computer/protocol-types";
import { StatusBar } from "./StatusBar.js";
import { EventStream } from "./EventStream.js";
import { ContextPanel, type ArtifactHeaderBrief } from "./ContextPanel.js";
import { InputBar } from "./InputBar.js";
import {
  initialRunState,
  applyEvent,
  type RunState,
} from "./events.js";

interface AppProps {
  artifactHeaders: ArtifactHeaderBrief[];
  onRun: (request: string) => Promise<void>;
  /** 外部调用此函数注册事件处理器 */
  eventEmitter: (handler: (event: TuiEvent) => void) => void;
}

export function App({ artifactHeaders, onRun, eventEmitter }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<RunState>(initialRunState());
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState("0.0");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // 注册事件处理器
  useEffect(() => {
    eventEmitter((event: TuiEvent) => {
      setState((prev) => applyEvent(prev, event));
    });
  }, [eventEmitter]);

  // 计时器：持续更新 StatusBar 的秒数
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.phase !== "idle" && prev.phase !== "done" && prev.startTime > 0) {
          setElapsed(((Date.now() - prev.startTime) / 1000).toFixed(1));
        } else if (prev.phase === "done") {
          setElapsed((prev.totalMs / 1000).toFixed(1));
        }
        return prev;
      });
    }, 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleSubmit = useCallback(async (request: string) => {
    setRunning(true);
    setState(initialRunState());
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
    <Box flexDirection="column">
      <StatusBar phase={state.phase} runId={state.runId} elapsed={elapsed} />

      <Box flexDirection="row">
        <Box flexDirection="column" width="65%">
          <EventStream state={state} />
        </Box>
        <Box flexDirection="column" width={1}>
          <Text color="gray">│</Text>
        </Box>
        <Box flexDirection="column" width="34%">
          <ContextPanel state={state} headers={artifactHeaders} />
        </Box>
      </Box>

      <InputBar onSubmit={handleSubmit} onQuit={handleQuit} disabled={running} />
    </Box>
  );
}
