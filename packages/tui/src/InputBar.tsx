import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface InputBarProps {
  onSubmit: (text: string) => void;
  onQuit: () => void;
  disabled: boolean;
}

export function InputBar({ onSubmit, onQuit, disabled }: InputBarProps) {
  const [input, setInput] = useState("");

  useInput((ch, key) => {
    if (key.escape) {
      onQuit();
      return;
    }
    if (disabled) return;
    if (key.return) {
      if (input.trim()) {
        onSubmit(input.trim());
        setInput("");
      }
      return;
    }
    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }
    setInput((prev) => prev + ch);
  });

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="green">&gt; </Text>
      <Text>{input}</Text>
      <Text color="gray">{disabled ? "" : "│"}</Text>
      <Text> </Text>
      {disabled ? (
        <Text color="yellow">running…</Text>
      ) : (
        <Text color="gray">[Enter] Run  [Esc] Quit</Text>
      )}
    </Box>
  );
}
