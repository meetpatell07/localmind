"use client";

import { type FormEvent, useRef, useEffect, type KeyboardEvent } from "react";
import { Button } from "@/frontend/components/ui/button";
import { Textarea } from "@/frontend/components/ui/textarea";
import { SendHorizonal, Square } from "lucide-react";

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  stop?: () => void;
  disabled?: boolean;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  stop,
  disabled,
}: ChatInputProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
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
    <div className="px-6 pb-5 pt-2">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="flex items-end gap-3 max-w-3xl mx-auto p-3 rounded-2xl bg-surface-elevated/80 ring-1 ring-border/40 focus-within:ring-primary/30 focus-within:bg-surface-elevated transition-all duration-200 backdrop-blur-sm"
      >
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={onInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Message LocalMind…"
          disabled={disabled}
          className="flex-1 resize-none min-h-[40px] max-h-[200px] bg-transparent border-0 shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60 p-0 px-1"
          rows={1}
          spellCheck={false}
        />
        {isLoading && stop ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={stop}
            className="shrink-0 h-8 w-8 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || disabled}
            className="shrink-0 h-8 w-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 disabled:shadow-none disabled:opacity-30 transition-all duration-200"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
          </Button>
        )}
      </form>
    </div>
  );
}
