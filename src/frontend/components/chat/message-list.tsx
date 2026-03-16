"use client";

import { useEffect, useRef } from "react";
import type { Message } from "ai";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/frontend/components/ui/scroll-area";
import { Brain, Sparkles } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

const SUGGESTED_PROMPTS = [
  "What did we talk about last time?",
  "Help me plan my day",
  "What do you know about me?",
];

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status">
        <div className="text-center space-y-6 animate-fade-in">
          {/* Breathing brain icon */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center animate-breathe ring-1 ring-primary/10">
            <Brain className="h-8 w-8 text-primary/70" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-heading font-bold text-foreground">
              Hey, Meet
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Ask me anything — I remember our conversations.
            </p>
          </div>

          {/* Suggested prompts */}
          <div className="flex flex-wrap gap-2 justify-center max-w-sm mx-auto">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="group flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground bg-surface-elevated hover:bg-surface-overlay hover:text-foreground rounded-full ring-1 ring-border/30 hover:ring-primary/30 transition-all duration-200"
                onClick={() => {
                  // Dispatch to the chat input
                  const input = document.querySelector<HTMLTextAreaElement>("textarea");
                  if (input) {
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype, "value"
                    )?.set;
                    nativeInputValueSetter?.call(input, prompt);
                    input.dispatchEvent(new Event("input", { bubbles: true }));
                    input.focus();
                  }
                }}
              >
                <Sparkles className="h-3 w-3 text-primary/60 group-hover:text-primary transition-colors" aria-hidden="true" />
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 px-6">
      <div className="space-y-5 py-6 max-w-3xl mx-auto" aria-live="polite">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center bg-surface-elevated ring-1 ring-border/50" aria-hidden="true">
              <Brain className="h-3.5 w-3.5 text-primary/60" />
            </div>
            <div className="bg-surface-elevated ring-1 ring-border/30 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce-dot stagger-1" />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce-dot stagger-2" />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce-dot stagger-3" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
