"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageList } from "@/frontend/components/chat/message-list";
import { ChatInput } from "@/frontend/components/chat/chat-input";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ChatPage() {
  // Use a ref so DefaultChatTransport always reads the current sessionId,
  // even though the transport object is only constructed once.
  const sessionIdRef = useRef<string | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState(true);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // body as a function: evaluated on every request, picks up current sessionId
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

  // Create session + health check on mount
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Summarize session on unmount
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
    <div className="flex flex-col h-full">
      {(!ollamaOnline || error) && (
        <div
          className="flex items-center gap-3 px-6 py-2.5 shrink-0"
          style={{
            background: "rgba(248,113,113,0.05)",
            borderBottom: "1px solid rgba(248,113,113,0.15)",
          }}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(248,113,113,0.7)" }} />
          <span className="font-mono text-[11px]" style={{ color: "rgba(248,113,113,0.7)" }}>
            Ollama is starting up — responses will resume shortly
          </span>
          <button
            className="ml-auto flex items-center gap-1.5 font-mono text-[10px] opacity-50 hover:opacity-80"
            style={{ color: "rgba(248,113,113,0.7)" }}
            onClick={checkOllama}
          >
            <RefreshCw className="h-3 w-3" />
            retry
          </button>
        </div>
      )}

      <MessageList messages={messages} isStreaming={isStreaming} onSendMessage={sendMessage} />

      <ChatInput
        onSendMessage={sendMessage}
        isStreaming={isStreaming}
        stop={stop}
        disabled={!ollamaOnline && !isStreaming}
      />
    </div>
  );
}
