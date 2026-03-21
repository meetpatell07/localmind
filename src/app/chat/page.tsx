"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { SessionSidebar } from "@/components/chat/session-sidebar";
import { SessionTranscript } from "@/components/chat/session-transcript";
import { AlertCircleIcon, RefreshIcon, SidebarLeft01Icon } from "hugeicons-react";
import { cn } from "@/lib/utils";

function LiveChat({
  sessionIdRef,
  ollamaOnline,
  error,
  onCheckOllama,
  initialMessages,
}: {
  sessionIdRef: React.RefObject<string | null>;
  ollamaOnline: boolean;
  error: Error | undefined;
  onCheckOllama: () => void;
  initialMessages?: UIMessage[];
}) {
  const { messages, sendMessage, status, stop } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ sessionId: sessionIdRef.current }),
    }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <>
      {(!ollamaOnline || error) && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 shrink-0 bg-red-50/50 border-b border-red-100">
          <AlertCircleIcon className="size-3.5 shrink-0 text-red-500" />
          <span className="text-xs font-medium text-red-600">
            Ollama is starting up — responses will resume shortly
          </span>
          <button
            className="ml-auto flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
            onClick={onCheckOllama}
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
    </>
  );
}

export default function ChatPage() {
  const sessionIdRef = useRef<string | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState(true);
  const [chatKey, setChatKey] = useState(0);
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionRefreshTick, setSessionRefreshTick] = useState(0);
  const [forkedMessages, setForkedMessages] = useState<UIMessage[] | undefined>(undefined);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function checkOllama() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) setOllamaOnline(true);
      else retryRef.current = setTimeout(checkOllama, 3000);
    } catch {
      retryRef.current = setTimeout(checkOllama, 3000);
    }
  }

  async function createNewSession() {
    const res = await fetch("/api/sessions", { method: "POST" });
    const data = (await res.json()) as { sessionId?: string };
    return data.sessionId ?? null;
  }

  async function initSession() {
    const sessionId = await createNewSession();
    if (sessionId) sessionIdRef.current = sessionId;
  }

  useEffect(() => {
    fetch("/api/health")
      .then((r) => setOllamaOnline(r.ok))
      .catch(() => setOllamaOnline(false));

    initSession();

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewSession = useCallback(async () => {
    const sessionId = await createNewSession();
    if (sessionId) sessionIdRef.current = sessionId;
    setViewingSessionId(null);
    setForkedMessages(undefined);
    setChatKey((k) => k + 1);
    setSessionRefreshTick((t) => t + 1);
  }, []);

  const handleSelectSession = useCallback((id: string | null) => {
    setViewingSessionId(id);
  }, []);

  const handleFork = useCallback((newSessionId: string, messages: Array<{ role: string; content: string }>) => {
    // Set the forked session as current
    sessionIdRef.current = newSessionId;
    // Convert DB messages to UIMessage format for initialMessages
    const uiMessages: UIMessage[] = messages.map((m, i) => ({
      id: `fork-${i}`,
      role: m.role as "user" | "assistant",
      content: m.content,
      parts: [{ type: "text" as const, text: m.content }],
    }));
    setForkedMessages(uiMessages);
    setViewingSessionId(null);
    setChatKey((k) => k + 1);
    setSessionRefreshTick((t) => t + 1);
  }, []);

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      {/* Sessions sidebar */}
      <div
        className={cn(
          "transition-all duration-200 overflow-hidden shrink-0",
          sidebarOpen ? "w-64" : "w-0"
        )}
      >
        <SessionSidebar
          activeSessionId={viewingSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          refreshTrigger={sessionRefreshTick}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 md:px-6 py-4 shrink-0 border-b border-gray-100">
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="size-7 rounded-md hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
            title="Toggle sessions panel"
          >
            <SidebarLeft01Icon className="size-4 text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-gray-900 leading-none">
              {viewingSessionId ? "Past session" : "Chat"}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`size-1.5 rounded-full ${ollamaOnline ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="text-xs font-medium text-gray-500">
              {ollamaOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        {/* Content */}
        {viewingSessionId ? (
          <SessionTranscript
            sessionId={viewingSessionId}
            onBack={() => setViewingSessionId(null)}
            onFork={handleFork}
          />
        ) : (
          <LiveChat
            key={chatKey}
            sessionIdRef={sessionIdRef}
            ollamaOnline={ollamaOnline}
            error={undefined}
            onCheckOllama={checkOllama}
            initialMessages={forkedMessages}
          />
        )}
      </div>
    </div>
  );
}
