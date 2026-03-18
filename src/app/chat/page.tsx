"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { AlertCircleIcon, RefreshIcon } from "hugeicons-react";

export default function ChatPage() {
  const sessionIdRef = useRef<string | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState(true);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ sessionId: sessionIdRef.current }),
    }),
    onFinish() {
      setOllamaOnline(true);
    },
    onError() {
      setOllamaOnline(false);
      retryRef.current = setTimeout(checkOllama, 3000);
    },
  });

  useEffect(() => {
    fetch("/api/health")
      .then((r) => setOllamaOnline(r.ok))
      .catch(() => setOllamaOnline(false));

    fetch("/api/memory?action=create-session", { method: "POST" })
      .then((r) => r.json())
      .then((d: { sessionId?: string }) => {
        if (d.sessionId) sessionIdRef.current = d.sessionId;
      })
      .catch(() => {});
  }, []);

  async function checkOllama() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) setOllamaOnline(true);
      else retryRef.current = setTimeout(checkOllama, 3000);
    } catch {
      retryRef.current = setTimeout(checkOllama, 3000);
    }
  }

  useEffect(() => {
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      const sid = sessionIdRef.current;
      if (sid && messages.length >= 4) {
        fetch("/api/memory?action=summarize-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [messages.length]);

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Chat</h1>
          <p className="text-sm text-gray-500 mt-1">
            {messages.length > 0
              ? `${messages.length} message${messages.length !== 1 ? "s" : ""} this session`
              : "Start a new conversation with LocalMind."}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`size-1.5 rounded-full ${ollamaOnline ? "bg-emerald-500" : "bg-red-400"}`} />
          <span className="text-xs font-medium text-gray-500">
            {ollamaOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Offline banner */}
      {(!ollamaOnline || error) && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 shrink-0 bg-red-50/50 border-b border-red-100">
          <AlertCircleIcon className="size-3.5 shrink-0 text-red-500" />
          <span className="text-xs font-medium text-red-600">
            Ollama is starting up — responses will resume shortly
          </span>
          <button
            className="ml-auto flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
            onClick={checkOllama}
          >
            <RefreshIcon className="size-3" />
            Retry
          </button>
        </div>
      )}

      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={sendMessage}
      />

      <ChatInput
        onSendMessage={sendMessage}
        isStreaming={isStreaming}
        stop={stop}
        disabled={!ollamaOnline && !isStreaming}
      />
    </div>
  );
}
