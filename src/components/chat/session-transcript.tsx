"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loading03Icon, ArrowLeft01Icon } from "hugeicons-react";
import { cn } from "@/lib/utils";

interface TranscriptMessage {
  role: string;
  content: string;
}

interface SessionTranscriptProps {
  sessionId: string;
  onBack: () => void;
}

export function SessionTranscript({ sessionId, onBack }: SessionTranscriptProps) {
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.json())
      .then((d: { messages: TranscriptMessage[] }) => setMessages(d.messages ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-gray-100 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft01Icon className="size-4" />
          Back
        </button>
        <div className="h-4 w-px bg-gray-200" />
        <span className="text-sm font-medium text-gray-700 truncate">Past conversation</span>
        <span className="ml-auto text-xs text-gray-400">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loading03Icon className="size-5 text-gray-300 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">No messages in this session.</p>
          </div>
        ) : (
          <div className="space-y-5 py-6 max-w-3xl mx-auto">
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={i}
                  className={cn(
                    "flex gap-3 w-full",
                    isUser ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div
                    className={cn(
                      "size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 shadow-sm",
                      isUser
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-500 text-[10px] font-bold"
                    )}
                  >
                    {isUser ? "M" : "AI"}
                  </div>
                  {isUser ? (
                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-md bg-gray-900 text-white">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 max-w-[80%] pt-0.5">
                      <div className="text-sm leading-relaxed text-gray-800">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:text-gray-900 prose-headings:font-semibold prose-code:text-gray-800 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2"
                          components={{
                            pre: ({ children }) => (
                              <pre className="overflow-x-auto rounded-xl p-3.5 text-[13px] my-3 bg-gray-50 border border-gray-100 text-gray-800">
                                {children}
                              </pre>
                            ),
                            code: ({ children, className }) =>
                              className?.includes("language-") ? (
                                <code className={className}>{children}</code>
                              ) : (
                                <code className="rounded-md px-1.5 py-0.5 text-[13px] bg-gray-100 text-gray-700">
                                  {children}
                                </code>
                              ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
