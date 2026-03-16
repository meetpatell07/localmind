"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "ai";

interface MessageBubbleProps {
  message: UIMessage;
}

function getTextContent(message: UIMessage): string {
  // v6: text is in parts
  if (message.parts?.length) {
    return message.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  // fallback for any compat
  return (message as unknown as { content: string }).content ?? "";
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const text = getTextContent(message);

  if (!text) return null;

  return (
    <div className={`flex gap-3 w-full ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Role label */}
      <span
        className="font-mono text-[9px] shrink-0 mt-1 w-8 text-right leading-none"
        style={{
          color: isUser ? "var(--amber)" : "hsl(215 12% 35%)",
          paddingTop: "3px",
        }}
      >
        {isUser ? "you" : "ai"}
      </span>

      {/* Bubble */}
      <div
        className="max-w-[80%] px-4 py-3 rounded-sm text-[13px] leading-relaxed"
        style={
          isUser
            ? {
                background: "var(--amber-dim)",
                border: "1px solid rgba(240,160,21,0.2)",
                color: "var(--amber)",
                fontFamily: "var(--font-mono, monospace)",
              }
            : {
                background: "var(--surface-raised)",
                border: "1px solid var(--line)",
                color: "hsl(210 18% 78%)",
              }
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap font-mono text-[12px]">{text}</p>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            className="prose-localmind"
            components={{
              pre: ({ children }) => (
                <pre
                  className="overflow-x-auto rounded-sm p-3 text-xs my-3 font-mono"
                  style={{
                    background: "var(--navy)",
                    border: "1px solid var(--line)",
                    color: "hsl(210 18% 70%)",
                  }}
                >
                  {children}
                </pre>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                return isBlock ? (
                  <code className={className}>{children}</code>
                ) : (
                  <code
                    className="rounded-sm px-1.5 py-0.5 text-xs font-mono"
                    style={{
                      background: "var(--navy)",
                      border: "1px solid var(--line)",
                      color: "hsl(48 80% 70%)",
                    }}
                  >
                    {children}
                  </code>
                );
              },
            }}
          >
            {text}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
