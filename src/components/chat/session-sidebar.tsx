"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Add01Icon,
  Delete02Icon,
  MessageMultiple01Icon,
  Loading03Icon,
} from "hugeicons-react";

interface SessionItem {
  id: string;
  channel: string;
  startedAt: string;
  turnCount: number | null;
  summary: string | null;
}

interface SessionSidebarProps {
  activeSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onNewSession: () => void;
  refreshTrigger?: number;
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function SessionSidebar({
  activeSessionId,
  onSelectSession,
  onNewSession,
  refreshTrigger,
}: SessionSidebarProps) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      const data = (await res.json()) as { sessions: SessionItem[] };
      setSessions(data.sessions ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, refreshTrigger]);

  async function handleDelete(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    setDeletingId(sessionId);
    try {
      await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) onSelectSession(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className="w-64 shrink-0 border-r border-gray-100 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Sessions
        </span>
        <button
          onClick={onNewSession}
          className="size-6 rounded-md bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          title="New session"
        >
          <Add01Icon className="size-3.5 text-gray-600" />
        </button>
      </div>

      {/* Current session entry */}
      <button
        onClick={() => onSelectSession(null)}
        className={cn(
          "flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors border-b border-gray-100 shrink-0",
          activeSessionId === null
            ? "bg-blue-50 text-blue-700"
            : "hover:bg-gray-50 text-gray-700"
        )}
      >
        <MessageMultiple01Icon className="size-3.5 shrink-0" />
        <span className="text-sm font-medium truncate">Current chat</span>
      </button>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loading03Icon className="size-4 text-gray-300 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center px-4 py-8 leading-relaxed">
            No past sessions yet. Start chatting!
          </p>
        ) : (
          <div className="py-1">
            {sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const isDeleting = deletingId === session.id;
              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "group flex items-start gap-2 px-4 py-2.5 cursor-pointer transition-colors relative",
                    isActive
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-xs font-medium leading-snug line-clamp-2",
                        isActive ? "text-blue-700" : "text-gray-700"
                      )}
                    >
                      {session.summary ?? "Untitled session"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-gray-400">
                        {relativeDate(session.startedAt)}
                      </span>
                      {session.turnCount !== null && session.turnCount > 0 && (
                        <>
                          <span className="text-[10px] text-gray-300">·</span>
                          <span className="text-[10px] text-gray-400">
                            {session.turnCount} turn{session.turnCount !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    className={cn(
                      "shrink-0 size-5 rounded flex items-center justify-center transition-all",
                      "opacity-0 group-hover:opacity-100",
                      "hover:bg-red-50 hover:text-red-500 text-gray-400"
                    )}
                    title="Delete session"
                  >
                    {isDeleting ? (
                      <Loading03Icon className="size-3 animate-spin" />
                    ) : (
                      <Delete02Icon className="size-3" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
