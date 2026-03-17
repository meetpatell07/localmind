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
    <div className="px-6 pb-5 pt-3 shrink-0 border-t border-border">
      <div
        className={cn(
          "flex items-end gap-3 max-w-3xl mx-auto px-4 py-3 rounded-lg border transition-colors bg-white",
          input ? "border-foreground/20" : "border-border",
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message LocalMind..."
          disabled={disabled}
          rows={1}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground min-h-[24px] max-h-[200px]"
        />
        {isStreaming && stop ? (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={stop}
            className="shrink-0 bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/15"
          >
            <SquareIcon className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={submit}
            disabled={!input.trim() || disabled}
            className={cn(
              "shrink-0 transition-all",
              input.trim()
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-gray-100 text-muted-foreground",
              "disabled:opacity-30",
            )}
          >
            <ArrowUp01Icon className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground text-center mt-2">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}
