"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { MessageBubble } from "./message-bubble";
import {
  Brain02Icon,
  Calendar03Icon,
  Search01Icon,
  SparklesIcon,
  MessageMultiple01Icon,
} from "hugeicons-react";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
  onSendMessage: (msg: { text: string }) => void;
}

const SUGGESTED_PROMPTS = [
  { text: "What did we talk about last time?", icon: MessageMultiple01Icon },
  { text: "Help me plan my day", icon: Calendar03Icon },
  { text: "What do you know about me?", icon: Search01Icon },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function MessageList({ messages, isStreaming, onSendMessage }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center space-y-8 max-w-md mx-auto animate-fade-in">
          <div className="mx-auto size-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center">
            <Brain02Icon className="size-7 text-gray-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              {getGreeting()}, Meet.
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              I remember everything we discuss. What&apos;s on your mind?
            </p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 justify-center">
            {SUGGESTED_PROMPTS.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.text}
                  onClick={() => onSendMessage({ text: prompt.text })}
                  className={cn(
                    "group flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium",
                    "bg-white hover:shadow-sm transition-all duration-200",
                    "text-gray-700 border-gray-200 hover:border-gray-300"
                  )}
                >
                  <Icon className="size-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                  {prompt.text}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-6">
      <div className="space-y-5 py-6 max-w-3xl mx-auto">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="size-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <SparklesIcon className="size-3.5 text-gray-400 animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="size-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-gray-200 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
