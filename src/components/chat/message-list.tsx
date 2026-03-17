"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { MessageBubble } from "./message-bubble";
import { Button } from "@/components/ui/button";
import { Brain02Icon, SparklesIcon } from "hugeicons-react";

interface MessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
  onSendMessage: (msg: { text: string }) => void;
}

const SUGGESTED_PROMPTS = [
  "What did we talk about last time?",
  "Help me plan my day",
  "What do you know about me?",
];

export function MessageList({ messages, isStreaming, onSendMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center space-y-6">
          <div className="mx-auto w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
            <Brain02Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Hey, Meet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              I remember our conversations. Ask me anything.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => onSendMessage({ text: prompt })}
                className="text-muted-foreground hover:text-foreground"
              >
                <SparklesIcon className="h-3 w-3" />
                {prompt}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6">
      <div className="space-y-4 py-6 max-w-3xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isStreaming && (
          <div className="flex gap-3">
            <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
              AI
            </div>
            <div className="px-4 py-3 rounded-lg border border-border bg-white">
              <span className="text-sm text-muted-foreground animate-pulse">
                █
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
