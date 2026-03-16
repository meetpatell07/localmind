"use client";

import { useEffect, useRef } from "react";
import { useChat } from "ai/react";
import { MessageList } from "@/frontend/components/chat/message-list";
import { ChatInput } from "@/frontend/components/chat/chat-input";
import { useChatStore } from "@/frontend/lib/stores/chat-store";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/frontend/components/ui/button";

export default function ChatPage() {
  const { sessionId, setSessionId, ollamaOnline, setOllamaOnline } = useChatStore();
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, stop, error } =
    useChat({
      api: "/api/chat",
      body: { sessionId },
      onResponse(response) {
        setOllamaOnline(true);
        // Capture session ID from response header
        const sid = response.headers.get("X-Session-Id");
        if (sid && !sessionId) setSessionId(sid);
      },
      onError() {
        setOllamaOnline(false);
        // Auto-retry after 3s
        retryTimeoutRef.current = setTimeout(() => {
          checkOllama();
        }, 3000);
      },
    });

  async function checkOllama() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) setOllamaOnline(true);
    } catch {
      retryTimeoutRef.current = setTimeout(checkOllama, 3000);
    }
  }

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Offline banner */}
      {(!ollamaOnline || error) && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-destructive/5 border-b border-destructive/10 text-sm animate-slide-up">
          <div className="flex items-center gap-2 text-destructive/80">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="font-medium">AI is starting up…</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-3 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-lg"
            onClick={checkOllama}
          >
            <RefreshCw className="h-3 w-3 mr-1.5" aria-hidden="true" />
            Retry
          </Button>
        </div>
      )}

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput
        input={input}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        disabled={!ollamaOnline && !isLoading}
      />
    </div>
  );
}
