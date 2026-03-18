"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { SquareIcon, ArrowUp01Icon } from "hugeicons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (msg: { text: string }) => void;
  isStreaming: boolean;
  stop?: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, isStreaming, stop, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
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

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  return (
    <div className="px-4 md:px-6 pb-5 pt-3 shrink-0">
      <div
        className={cn(
          "max-w-3xl mx-auto rounded-2xl border bg-white shadow-sm transition-all duration-200",
          isFocused
            ? "border-gray-300 shadow-md ring-1 ring-gray-200/50"
            : "border-gray-200",
        )}
      >
        <div className="flex items-end gap-3 px-4 py-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Message LocalMind..."
            disabled={disabled}
            rows={1}
            spellCheck={false}
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 min-h-[24px] max-h-[200px] leading-relaxed"
          />
          {isStreaming && stop ? (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={stop}
              className="shrink-0 size-8 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
            >
              <SquareIcon className="size-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={submit}
              disabled={!input.trim() || disabled}
              className={cn(
                "shrink-0 size-8 rounded-xl transition-all duration-200",
                input.trim()
                  ? "bg-gray-900 text-white hover:bg-gray-800 shadow-sm"
                  : "bg-gray-100 text-gray-400",
                "disabled:opacity-30",
              )}
            >
              <ArrowUp01Icon className="size-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between px-4 pb-2.5">
          <p className="text-[11px] text-gray-400 select-none">
            <kbd className="inline-flex h-4 items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 text-[10px] font-medium text-gray-500 mr-0.5">↵</kbd>
            {" "}send
            <span className="mx-1.5 text-gray-300">·</span>
            <kbd className="inline-flex h-4 items-center justify-center rounded border border-gray-200 bg-gray-50 px-1 text-[10px] font-medium text-gray-500 mr-0.5">⇧↵</kbd>
            {" "}new line
          </p>
        </div>
      </div>
    </div>
  );
}
