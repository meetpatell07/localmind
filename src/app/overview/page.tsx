"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search02Icon,
  MessageMultiple01Icon,
  AiBrain02Icon,
  CheckListIcon,
  Folder01Icon,
  Mic01Icon,
  Mail01Icon,
  Cancel01Icon,
} from "hugeicons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApiSession {
  id: string;
  startedAt: string;
  turnCount: number | null;
  summary: string | null;
  channel: string | null;
}

interface ApiTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  tags: string[] | null;
}

interface SearchResult {
  contentText: string;
  sourceType: string;
  createdAt: string;
}

type SourceType = "chat" | "memory" | "planner" | "vault" | "voice" | "email";

interface ActivityItem {
  id: string;
  type: SourceType;
  rawDate: Date;
  tag: string;
  senderInitial: string;
  senderInitialColor: string;
  senderName: string;
  senderDetail: string;
  subject: string;
  body: string;
  sourceIcon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  sourceColor: string;
  href: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function sessionToItem(s: ApiSession): ActivityItem {
  const turns = s.turnCount ?? 0;
  return {
    id: `session-${s.id}`,
    type: "chat",
    rawDate: new Date(s.startedAt),
    tag: "Chat",
    senderInitial: "AI",
    senderInitialColor: "bg-blue-100 text-blue-700",
    senderName: "Chat Session",
    senderDetail: `${turns} turn${turns !== 1 ? "s" : ""}`,
    subject: s.summary ?? "New conversation",
    body: s.summary ?? "A chat session was started.",
    sourceIcon: MessageMultiple01Icon,
    sourceColor: "text-blue-500 bg-blue-50",
    href: "/chat",
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

function taskToItem(t: ApiTask): ActivityItem {
  return {
    id: `task-${t.id}`,
    type: "planner",
    rawDate: new Date(t.createdAt),
    tag: "Planner",
    senderInitial: "T",
    senderInitialColor: PRIORITY_COLORS[t.priority] ?? "bg-gray-100 text-gray-700",
    senderName: "Task",
    senderDetail: `${t.priority} priority · ${t.status.replace("_", " ")}`,
    subject: t.title,
    body: t.tags?.length
      ? `Tags: ${t.tags.join(", ")}`
      : `Status: ${t.status.replace("_", " ")}`,
    sourceIcon: CheckListIcon,
    sourceColor: "text-emerald-500 bg-emerald-50",
    href: "/planner",
  };
}

function groupByDate(items: ActivityItem[]): Record<string, ActivityItem[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const d = new Date(item.rawDate);
    d.setHours(0, 0, 0, 0);
    let label: string;
    if (d.getTime() === today.getTime()) label = "TODAY";
    else if (d.getTime() === yesterday.getTime()) label = "YESTERDAY";
    else label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase();
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  return groups;
}

// ── Tab config ────────────────────────────────────────────────────────────────

const tabs = [
  { id: "all", label: "All Sources", icon: null },
  { id: "chat", label: "Chat", icon: MessageMultiple01Icon, color: "text-blue-500" },
  { id: "memory", label: "Memory", icon: AiBrain02Icon, color: "text-purple-500" },
  { id: "planner", label: "Planner", icon: CheckListIcon, color: "text-emerald-500" },
  { id: "vault", label: "Vault", icon: Folder01Icon, color: "text-amber-500" },
  { id: "voice", label: "Voice", icon: Mic01Icon, color: "text-rose-500" },
  { id: "email", label: "Email", icon: Mail01Icon, color: "text-red-500" },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="flex flex-col border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 flex flex-col gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-3 w-12 bg-gray-100 rounded" />
            <div className="h-4 w-20 bg-gray-100 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-full bg-gray-100 shrink-0 ml-14" />
            <div className="flex flex-col gap-1 flex-1">
              <div className="h-3 w-32 bg-gray-100 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
          </div>
          <div className="ml-14 flex flex-col gap-1">
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch real data on mount
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [sessionsRes, tasksRes] = await Promise.allSettled([
          fetch("/api/sessions").then((r) => r.json()),
          fetch("/api/tasks").then((r) => r.json()),
        ]);

        const sessionItems: ActivityItem[] =
          sessionsRes.status === "fulfilled"
            ? (sessionsRes.value.sessions as ApiSession[] ?? []).map(sessionToItem)
            : [];

        const taskItems: ActivityItem[] =
          tasksRes.status === "fulfilled"
            ? (tasksRes.value.tasks as ApiTask[] ?? []).map(taskToItem)
            : [];

        const combined = [...sessionItems, ...taskItems].sort(
          (a, b) => b.rawDate.getTime() - a.rawDate.getTime()
        );
        setItems(combined);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  // Debounced memory search
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!q.trim()) {
      setSearchResults(null);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/memory?type=search&q=${encodeURIComponent(q)}`);
        const data = await res.json() as { results?: SearchResult[] };
        setSearchResults(data.results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  // Filter items by tab
  const filtered = activeTab === "all"
    ? items
    : items.filter((i) => i.type === activeTab);

  const grouped = groupByDate(filtered);
  const groupKeys = Object.keys(grouped);

  return (
    <div className="flex flex-col min-h-full w-full max-w-5xl mx-auto px-6 pt-4 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? "Loading activity…"
              : `${items.length} event${items.length !== 1 ? "s" : ""} across your workspace`}
          </p>
        </div>
        <div className="relative w-full md:w-64 shrink-0">
          <Search02Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search memory…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-10 bg-white border-gray-200 shadow-sm focus-visible:ring-gray-200 rounded-lg h-9"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Cancel01Icon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border mb-6 overflow-x-auto no-scrollbar pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(""); setSearchResults(null); }}
              className={cn(
                "group flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon && (
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    isActive ? (tab as { color?: string }).color : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
              )}
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Search results mode */}
      {searchResults !== null ? (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {searching ? "Searching…" : `${searchResults.length} memory result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
          </p>
          {searching ? (
            <FeedSkeleton />
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400">No memories found matching your query.</div>
          ) : (
            <div className="flex flex-col border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
              {searchResults.map((r, i) => (
                <Link
                  key={i}
                  href="/memory"
                  className="p-4 md:p-5 hover:bg-gray-50/50 transition-colors block"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <AiBrain02Icon className="size-4 text-purple-500 shrink-0" />
                    <span className="text-[10px] font-medium text-purple-600 uppercase tracking-wider">{r.sourceType}</span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">{r.contentText}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="space-y-6">
          <div>
            <div className="h-3 w-16 bg-gray-100 rounded mb-4 animate-pulse" />
            <FeedSkeleton />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          {activeTab === "all"
            ? "No activity yet. Start a chat or create a task to see events here."
            : `No ${activeTab} activity yet.`}
        </div>
      ) : (
        /* Timeline feed */
        <div className="space-y-8">
          {groupKeys.map((label) => (
            <div key={label}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{label}</h3>
              <div className="flex flex-col border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                {grouped[label].map((event) => {
                  const SourceIcon = event.sourceIcon;
                  return (
                    <Link
                      key={event.id}
                      href={event.href}
                      className="p-4 md:p-5 flex flex-col gap-1 hover:bg-gray-50/50 transition-colors group cursor-pointer"
                    >
                      {/* Meta row */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 font-medium w-16 shrink-0">
                            {formatRelativeTime(event.rawDate)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50/50 border border-blue-100 text-[10px] font-medium text-blue-600">
                            <div className="size-1.5 rounded-full bg-blue-600" />
                            {event.tag}
                          </span>
                        </div>
                        <div className={cn("hidden md:flex items-center justify-center p-1 rounded-md", event.sourceColor)}>
                          <SourceIcon className="size-4" />
                        </div>
                      </div>

                      {/* Sender row */}
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-16 shrink-0 flex justify-end pr-2 md:pr-0">
                          <div className={cn("size-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm", event.senderInitialColor)}>
                            {event.senderInitial}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 mb-0.5">
                            <span className="text-sm font-semibold text-gray-900 truncate">{event.senderName}</span>
                            <span className="text-[13px] text-gray-500 truncate">{event.senderDetail}</span>
                          </div>
                        </div>
                        <div className={cn("flex md:hidden shrink-0 items-center justify-center p-1 rounded-md", event.sourceColor)}>
                          <SourceIcon className="size-4" />
                        </div>
                      </div>

                      {/* Content row */}
                      <div className="flex">
                        <div className="w-16 shrink-0 hidden md:block" />
                        <div className="flex-1 min-w-0 md:pl-3 pt-1">
                          <p className="text-[14px] font-semibold text-gray-900 mb-0.5 leading-snug">{event.subject}</p>
                          <p className="text-[13px] text-gray-500 line-clamp-2 leading-relaxed">{event.body}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
