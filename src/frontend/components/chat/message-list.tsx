"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { MessageBubble } from "./message-bubble";
import { Brain, Sparkles } from "lucide-react";

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
          <div
            className="mx-auto w-12 h-12 rounded-sm flex items-center justify-center"
            style={{ background: "var(--amber-dim)", border: "1px solid rgba(240,160,21,0.2)" }}
          >
            <Brain className="h-6 w-6" style={{ color: "var(--amber)" }} />
          </div>
          <div>
            <p className="font-mono text-[15px]" style={{ color: "hsl(210 18% 82%)" }}>
              Hey, Meet.
            </p>
            <p className="font-mono text-[11px] opacity-30 mt-1">
              I remember our conversations. Ask me anything.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onSendMessage({ text: prompt })}
                className="flex items-center gap-1.5 font-mono text-[10px] px-3 py-1.5 rounded-sm transition-colors"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--line)",
                  color: "hsl(215 12% 50%)",
                }}
              >
                <Sparkles className="h-3 w-3" style={{ color: "var(--amber)", opacity: 0.6 }} />
                {prompt}
              </button>
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
            <span className="font-mono text-[9px] opacity-20 mt-1 w-8 text-right">ai</span>
            <div
              className="px-4 py-3 rounded-sm"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
            >
              <span
                className="font-mono text-[14px]"
                style={{ color: "var(--amber)", opacity: 0.6 }}
              >
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
