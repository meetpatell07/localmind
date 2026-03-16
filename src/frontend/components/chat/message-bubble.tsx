"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/frontend/lib/utils";
import type { Message } from "ai";
import { Bot, User } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 w-full animate-slide-up",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
          isUser
            ? "bg-gradient-to-br from-primary/80 to-accent/60"
            : "bg-surface-elevated ring-1 ring-border/50"
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-primary-foreground" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-tr-sm"
            : "bg-surface-elevated ring-1 ring-border/30 text-foreground rounded-tl-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-heading"
            components={{
              pre: ({ children }) => (
                <pre className="overflow-x-auto rounded-lg border border-border/50 bg-background/80 p-3 text-xs my-3">
                  {children}
                </pre>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                return isBlock ? (
                  <code className={className}>{children}</code>
                ) : (
                  <code className="rounded-md bg-background/60 px-1.5 py-0.5 text-xs font-mono ring-1 ring-border/30">
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
