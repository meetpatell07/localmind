"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Square, ArrowRight } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (msg: { text: string }) => void;
  isStreaming: boolean;
  stop?: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, isStreaming, stop, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const text = input.trim();
    if (!text || disabled) return;
    onSendMessage({ text });
    setInput("");
  }

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div
      className="px-6 pb-5 pt-3 shrink-0"
      style={{ borderTop: "1px solid var(--line)" }}
    >
      <div
        className="flex items-end gap-3 max-w-3xl mx-auto px-4 py-3 rounded-sm transition-colors"
        style={{
          background: "var(--surface-raised)",
          border: `1px solid ${input ? "rgba(240,160,21,0.25)" : "var(--line)"}`,
        }}
      >
        <span
          className="font-mono text-[13px] shrink-0 mb-0.5 opacity-40"
          style={{ color: "var(--amber)" }}
        >
          →
        </span>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="message localmind..."
          disabled={disabled}
          rows={1}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent font-mono text-[13px] outline-none placeholder:opacity-20 min-h-[24px] max-h-[200px]"
          style={{ color: "hsl(210 18% 82%)" }}
        />
        {isStreaming && stop ? (
          <button
            type="button"
            onClick={stop}
            className="shrink-0 p-1.5 rounded-sm transition-colors"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "rgba(248,113,113,0.7)",
            }}
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim() || disabled}
            className="shrink-0 p-1.5 rounded-sm transition-all disabled:opacity-20"
            style={{
              background: input.trim() ? "var(--amber-dim)" : "transparent",
              border: `1px solid ${input.trim() ? "rgba(240,160,21,0.3)" : "var(--line)"}`,
              color: "var(--amber)",
            }}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="font-mono text-[9px] opacity-15 text-center mt-2">
        enter to send · shift+enter for newline
      </p>
    </div>
  );
}
