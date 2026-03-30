"use client";

import { use, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { AGENT_DEFINITIONS } from "@/agent/agent-definitions";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { AlertCircleIcon, ArrowLeft02Icon } from "hugeicons-react";
import { cn } from "@/lib/utils";

const colorDotMap: Record<string, string> = {
  blue:    "bg-blue-500",
  emerald: "bg-emerald-500",
  violet:  "bg-violet-500",
  amber:   "bg-amber-500",
  pink:    "bg-pink-500",
  cyan:    "bg-cyan-500",
  orange:  "bg-orange-500",
  teal:    "bg-teal-500",
  indigo:  "bg-indigo-500",
};

const colorBadgeMap: Record<string, string> = {
  blue:    "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  violet:  "bg-violet-50 text-violet-700",
  amber:   "bg-amber-50 text-amber-700",
  pink:    "bg-pink-50 text-pink-700",
  cyan:    "bg-cyan-50 text-cyan-700",
  orange:  "bg-orange-50 text-orange-700",
  teal:    "bg-teal-50 text-teal-700",
  indigo:  "bg-indigo-50 text-indigo-700",
};

export default function AgentChatPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const router = useRouter();
  const sessionIdRef = useRef<string | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState(true);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const agent = AGENT_DEFINITIONS.find((a) => a.id === agentId);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => setOllamaOnline(r.ok))
      .catch(() => setOllamaOnline(false));
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  const checkOllama = () => {
    fetch("/api/health")
      .then((r) => {
        if (r.ok) setOllamaOnline(true);
        else retryRef.current = setTimeout(checkOllama, 3000);
      })
      .catch(() => {
        retryRef.current = setTimeout(checkOllama, 3000);
      });
  };

  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/agents/${agentId}/chat`,
      body: () => ({ sessionId: sessionIdRef.current }),
      fetch: async (input, init) => {
        const response = await globalThis.fetch(input, init);
        const newSessionId = response.headers.get("X-Session-Id");
        if (newSessionId && !sessionIdRef.current) {
          sessionIdRef.current = newSessionId;
        }
        return response;
      },
    }),
  });

  const isStreaming = status === "streaming" || status === "submitted";

  if (!agent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-gray-500">Agent not found.</p>
        <button
          className="text-sm text-blue-600 hover:underline"
          onClick={() => router.push("/agents")}
        >
          Back to Agents
        </button>
      </div>
    );
  }

  const dotColor = colorDotMap[agent.color] ?? "bg-gray-500";
  const badgeColor = colorBadgeMap[agent.color] ?? "bg-gray-50 text-gray-600";

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 shrink-0 border-b border-gray-100">
        <button
          onClick={() => router.push("/agents")}
          className="size-7 rounded-md hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
          title="Back to Agents"
        >
          <ArrowLeft02Icon className="size-4 text-gray-500" strokeWidth={1.5} />
        </button>

        <span className={cn("size-2.5 rounded-full shrink-0", dotColor)} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-gray-900 leading-tight">
              {agent.name}
            </h1>
            <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full", badgeColor)}>
              {agent.role}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate hidden sm:block">
            {agent.description}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={cn(
              "size-1.5 rounded-full",
              ollamaOnline ? "bg-emerald-500" : "bg-red-400"
            )}
          />
          <span className="text-xs font-medium text-gray-500 hidden sm:block">
            {ollamaOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Offline banner */}
      {!ollamaOnline && (
        <div className="flex items-center gap-3 px-4 md:px-6 py-2 shrink-0 bg-red-50/50 border-b border-red-100">
          <AlertCircleIcon className="size-3.5 shrink-0 text-red-500" />
          <span className="text-xs font-medium text-red-600">
            Ollama is starting up — responses will resume shortly
          </span>
          <button
            className="ml-auto flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
            onClick={checkOllama}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state hint */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className={cn("size-12 rounded-full flex items-center justify-center", badgeColor)}>
            <span className="text-lg font-bold">{agent.name[0]}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{agent.name}</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">{agent.description}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-sm">
            {agent.capabilities.map((cap) => (
              <span
                key={cap}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600"
              >
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onSendMessage={sendMessage}
        />
      )}

      {/* Input */}
      <ChatInput
        onSendMessage={sendMessage}
        isStreaming={isStreaming}
        stop={stop}
        disabled={!ollamaOnline && !isStreaming}
      />
    </div>
  );
}
