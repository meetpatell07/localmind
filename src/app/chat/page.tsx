"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col h-full">
      {(!ollamaOnline || error) && (
        <div className="flex items-center gap-3 px-6 py-2.5 shrink-0 bg-destructive/5 border-b border-destructive/15">
          <AlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-destructive" />
          <span className="text-sm text-destructive">
            Ollama is starting up — responses will resume shortly
          </span>
          <Button
            variant="ghost"
            size="xs"
            className="ml-auto text-destructive/70 hover:text-destructive transition-colors"
            onClick={checkOllama}
          >
            <RefreshIcon className="h-3 w-3" />
            retry
          </Button>
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
