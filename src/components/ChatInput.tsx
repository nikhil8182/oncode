"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { ArrowUp, Paperclip, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
  isStreaming: boolean;
}

export default function ChatInput({ onSend, disabled, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + "px";
  }, []);

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 8,
        background: "var(--surface-alt)",
        border: "1px solid var(--border-alt)",
        borderRadius: "var(--radius-lg)",
        padding: "8px 12px",
      }}
    >
      {/* Attachment button (placeholder) */}
      <button
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          borderRadius: "var(--radius-sm)",
          flexShrink: 0,
          transition: "color 0.15s",
        }}
        title="Attach file"
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
      >
        <Paperclip size={16} />
      </button>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          adjustHeight();
        }}
        onKeyDown={handleKeyDown}
        placeholder="Ask Oncode anything..."
        disabled={disabled}
        rows={1}
        style={{
          flex: 1,
          resize: "none",
          background: "transparent",
          color: "var(--text)",
          fontSize: 13,
          lineHeight: 1.5,
          minHeight: 20,
          maxHeight: 160,
          padding: "6px 0",
          fontFamily: "var(--font-sans)",
        }}
      />

      {/* Send / Stop button */}
      <button
        onClick={handleSend}
        disabled={!canSend && !isStreaming}
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--radius-md)",
          flexShrink: 0,
          background: canSend || isStreaming ? "var(--accent)" : "var(--border)",
          color: canSend || isStreaming ? "#fff" : "var(--text-dim)",
          transition: "background 0.15s, color 0.15s",
        }}
        title={isStreaming ? "Stop" : "Send message"}
      >
        {isStreaming ? <Square size={14} /> : <ArrowUp size={16} />}
      </button>
    </div>
  );
}
