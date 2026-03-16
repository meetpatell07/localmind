"use client";

import { type FormEvent, useRef, type KeyboardEvent } from "react";
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

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex gap-2 p-4 border-t border-border bg-background"
    >
      <Textarea
        value={input}
        onChange={onInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Message LocalMind... (Enter to send, Shift+Enter for newline)"
        disabled={disabled}
        className="flex-1 resize-none min-h-[44px] max-h-[200px]"
        rows={1}
      />
      {isLoading && stop ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={stop}
          className="self-end shrink-0"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || disabled}
          className="self-end shrink-0"
        >
          <SendHorizonal className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
