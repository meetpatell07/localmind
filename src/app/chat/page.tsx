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
        <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>AI is starting up...</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-destructive hover:text-destructive"
            onClick={checkOllama}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
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
