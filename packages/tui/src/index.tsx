/**
 * @ethan-computer/tui — Ethan Debug Console
 *
 * 基于 Ink + React 的实时调试终端。
 */

export { App } from "./App.js";
export { InputBar } from "./InputBar.js";
export {
  initialRunState,
  applyEvent,
  type RunState,
  type Phase,
  type ToolCallRecord,
} from "./events.js";

import React from "react";
import { render } from "ink";
import { App } from "./App.js";
import type { TuiEvent } from "@ethan-computer/protocol-types";

export interface TuiOptions {
  onRun: (request: string) => Promise<void>;
}

/**
 * 启动 TUI。
 * 返回 emit 函数，runtime 通过它向 TUI 发送事件。
 */
export function startTui(options: TuiOptions): {
  emit: (event: TuiEvent) => void;
  waitUntilExit: () => Promise<void>;
} {
  let handler: ((event: TuiEvent) => void) | null = null;

  const eventEmitter = (h: (event: TuiEvent) => void) => {
    handler = h;
  };

  const { waitUntilExit } = render(
    React.createElement(App, {
      onRun: options.onRun,
      eventEmitter,
    }),
  );

  return {
    emit: (event: TuiEvent) => handler?.(event),
    waitUntilExit: async () => { await waitUntilExit(); },
  };
}
