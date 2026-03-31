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
} from "./events.js";

interface AppProps {
  onRun: (request: string) => Promise<void>;
  eventEmitter: (handler: (event: TuiEvent) => void) => void;
}

export function App({ onRun, eventEmitter }: AppProps) {
  const { exit } = useApp();
  const [state, setState] = useState<RunState>(initialRunState());
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState("0.0");
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    eventEmitter((event: TuiEvent) => {
      setState((prev) => applyEvent(prev, event));
    });
  }, [eventEmitter]);

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
      <EventStream state={state} />
      <InputBar onSubmit={handleSubmit} onQuit={handleQuit} disabled={running} />
    </Box>
  );
}
