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
  UserMultiple02Icon,
  ArrowRight02Icon,
  GoogleDriveIcon,
  File01Icon,
  Loading03Icon,
} from "hugeicons-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { AGENT_DEFINITIONS } from "@/agent/agent-definitions";
import type { AgentDefinition } from "@/agent/agent-definitions";

// ── Activity feed types ───────────────────────────────────────────────────────

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

type SourceType = "chat" | "memory" | "planner" | "vault" | "voice" | "email" | "agents";

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

// ── Files types ───────────────────────────────────────────────────────────────

interface VaultFile {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  category: string | null;
  createdAt: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeIcon(mime: string | null): string {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
  if (mime.includes("document") || mime.includes("word")) return "📝";
  if (mime.includes("zip") || mime.includes("archive")) return "📦";
  return "📄";
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
    body: t.tags?.length ? `Tags: ${t.tags.join(", ")}` : `Status: ${t.status.replace("_", " ")}`,
    sourceIcon: CheckListIcon,
    sourceColor: "text-emerald-500 bg-emerald-50",
    href: "/planner",
  };
}

function groupByDate(items: ActivityItem[]): Record<string, ActivityItem[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const groups: Record<string, ActivityItem[]> = {};
  for (const item of items) {
    const d = new Date(item.rawDate); d.setHours(0, 0, 0, 0);
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
  { id: "all",     label: "All",     icon: null },
  { id: "chat",    label: "Chat",    icon: MessageMultiple01Icon, color: "text-blue-500" },
  { id: "memory",  label: "Memory",  icon: AiBrain02Icon,         color: "text-purple-500" },
  { id: "planner", label: "Planner", icon: CheckListIcon,         color: "text-emerald-500" },
  { id: "voice",   label: "Voice",   icon: Mic01Icon,             color: "text-rose-500" },
  { id: "email",   label: "Email",   icon: Mail01Icon,            color: "text-red-500" },
  { id: "agents",  label: "Agents",  icon: UserMultiple02Icon,    color: "text-indigo-500" },
];

// ── Agent card colors ─────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, { dot: string; badge: string }> = {
  blue:    { dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-700" },
  emerald: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  violet:  { dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700" },
  amber:   { dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700" },
  pink:    { dot: "bg-pink-500",    badge: "bg-pink-50 text-pink-700" },
  cyan:    { dot: "bg-cyan-500",    badge: "bg-cyan-50 text-cyan-700" },
  orange:  { dot: "bg-orange-500",  badge: "bg-orange-50 text-orange-700" },
  teal:    { dot: "bg-teal-500",    badge: "bg-teal-50 text-teal-700" },
  indigo:  { dot: "bg-indigo-500",  badge: "bg-indigo-50 text-indigo-700" },
};

function AgentMiniCard({ agent }: { agent: AgentDefinition }) {
  const c = AGENT_COLORS[agent.color] ?? AGENT_COLORS.blue;
  return (
    <Link
      href={`/agents/${agent.id}`}
      className="group flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm transition-all"
    >
      <span className={cn("size-2 rounded-full shrink-0", c.dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{agent.name}</p>
        <p className="text-xs text-gray-400 truncate">{agent.role}</p>
      </div>
      <ArrowRight02Icon className="size-3.5 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" strokeWidth={2} />
    </Link>
  );
}

// ── Feed skeleton ─────────────────────────────────────────────────────────────

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
        </div>
      ))}
    </div>
  );
}

// ── Files panel (right column) ────────────────────────────────────────────────

function FilesPanel() {
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveConnected, setDriveConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState<"vault" | "drive">("vault");

  useEffect(() => {
    async function load() {
      const [vaultRes, driveRes] = await Promise.allSettled([
        fetch("/api/files").then((r) => r.json()),
        fetch("/api/drive?max=20").then((r) => r.json()),
      ]);
      if (vaultRes.status === "fulfilled") {
        setVaultFiles((vaultRes.value.files as VaultFile[] | null) ?? []);
      }
      if (driveRes.status === "fulfilled") {
        const d = driveRes.value as { files?: DriveFile[]; connected?: boolean };
        setDriveFiles(d.files ?? []);
        setDriveConnected(d.connected !== false);
      } else {
        setDriveConnected(false);
      }
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => setActiveFile("vault")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all",
            activeFile === "vault"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Folder01Icon className="size-3.5" strokeWidth={1.5} />
          Vault
        </button>
        <button
          onClick={() => setActiveFile("drive")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all",
            activeFile === "drive"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          <GoogleDriveIcon className="size-3.5" />
          Drive
        </button>
      </div>

      {/* File list */}
      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
          <Loading03Icon className="size-4 animate-spin" />
          <span className="text-xs">Loading…</span>
        </div>
      ) : activeFile === "vault" ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{vaultFiles.length} files</span>
            <Link href="/files" className="text-xs text-amber-600 hover:underline font-medium">Open →</Link>
          </div>
          {vaultFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <File01Icon className="size-6 text-gray-300 mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-xs text-gray-400">No files yet</p>
            </div>
          ) : (
            <div className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden divide-y divide-gray-50">
              {vaultFiles.slice(0, 10).map((f) => (
                <Link key={f.id} href="/files" className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50/60 transition-colors">
                  <span className="text-base shrink-0">{mimeIcon(f.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{f.fileName}</p>
                    <p className="text-[10px] text-gray-400">
                      {f.category ?? "Other"}{f.sizeBytes ? ` · ${formatBytes(f.sizeBytes)}` : ""}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatDate(f.createdAt)}</span>
                </Link>
              ))}
              {vaultFiles.length > 10 && (
                <Link href="/files" className="px-3 py-2.5 text-[10px] text-center text-amber-600 hover:bg-gray-50 transition-colors font-medium">
                  +{vaultFiles.length - 10} more →
                </Link>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">{driveConnected ? `${driveFiles.length} files` : "Not connected"}</span>
            <Link href="/drive" className="text-xs text-blue-600 hover:underline font-medium">Open →</Link>
          </div>
          {!driveConnected ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <GoogleDriveIcon className="size-6 text-gray-300 mx-auto mb-1.5" />
              <p className="text-xs text-gray-400 mb-2">Not connected</p>
              <Link href="/settings" className="text-xs font-medium text-blue-600 hover:underline">Connect in Settings →</Link>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">
              <p className="text-xs text-gray-400">No Drive files found</p>
            </div>
          ) : (
            <div className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden divide-y divide-gray-50">
              {driveFiles.slice(0, 10).map((f) => (
                <a
                  key={f.id}
                  href={f.webViewLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50/60 transition-colors"
                >
                  <span className="text-base shrink-0">{mimeIcon(f.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{f.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {f.mimeType.split(/[./]/).pop()}
                    </p>
                  </div>
                  {f.modifiedTime && (
                    <span className="text-[10px] text-gray-400 shrink-0">{formatDate(f.modifiedTime)}</span>
                  )}
                </a>
              ))}
              {driveFiles.length > 10 && (
                <Link href="/drive" className="px-3 py-2.5 text-[10px] text-center text-blue-600 hover:bg-gray-50 transition-colors font-medium">
                  +{driveFiles.length - 10} more →
                </Link>
              )}
            </div>
          )}
        </div>
      )}
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
        setItems([...sessionItems, ...taskItems].sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime()));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/memory?type=search&q=${encodeURIComponent(q)}`);
        const data = await res.json() as { results?: SearchResult[] };
        setSearchResults(data.results ?? []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 400);
  }, []);

  const filtered = activeTab === "all" ? items : items.filter((i) => i.type === activeTab);
  const grouped = groupByDate(filtered);
  const groupKeys = Object.keys(grouped);

  return (
    <div className="flex flex-col min-h-full w-full px-4 md:px-6 pt-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? "Loading…" : `${items.length} event${items.length !== 1 ? "s" : ""} across your workspace`}
          </p>
        </div>
        <div className="relative w-full sm:w-60 shrink-0">
          <Search02Icon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search memory…"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-9 bg-white border-gray-200 shadow-sm rounded-lg h-9"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <Cancel01Icon className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1">

        {/* Left — activity feed */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Tabs */}
          <div className="flex items-center gap-5 border-b border-border mb-5 overflow-x-auto no-scrollbar pb-px">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSearchQuery(""); setSearchResults(null); }}
                  className={cn(
                    "group flex items-center gap-1.5 pb-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {Icon && (
                    <Icon className={cn("size-3.5", isActive ? (tab as { color?: string }).color : "text-muted-foreground")} strokeWidth={1.5} />
                  )}
                  {tab.label}
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />}
                </button>
              );
            })}
          </div>

          {/* Agents tab content */}
          {activeTab === "agents" && searchResults === null ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{AGENT_DEFINITIONS.length} Agents</p>
                <Link href="/agents" className="text-xs text-indigo-600 hover:underline font-medium">Open Agents Dashboard →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AGENT_DEFINITIONS.map((agent) => <AgentMiniCard key={agent.id} agent={agent} />)}
              </div>
            </div>
          ) : searchResults !== null ? (
            /* Search results */
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
              </p>
              {searching ? <FeedSkeleton /> : searchResults.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400">No memories found.</div>
              ) : (
                <div className="flex flex-col border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                  {searchResults.map((r, i) => (
                    <Link key={i} href="/memory" className="p-4 hover:bg-gray-50/50 transition-colors block">
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
            <FeedSkeleton />
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              {activeTab === "all" ? "No activity yet." : `No ${activeTab} activity yet.`}
            </div>
          ) : (
            <div className="space-y-8">
              {groupKeys.map((label) => (
                <div key={label}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{label}</h3>
                  <div className="flex flex-col border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
                    {grouped[label].map((event) => {
                      const SourceIcon = event.sourceIcon;
                      return (
                        <Link key={event.id} href={event.href} className="p-4 flex flex-col gap-1 hover:bg-gray-50/50 transition-colors group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 font-medium w-14 shrink-0">{formatRelativeTime(event.rawDate)}</span>
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50/50 border border-blue-100 text-[10px] font-medium text-blue-600">
                                <div className="size-1.5 rounded-full bg-blue-600" />{event.tag}
                              </span>
                            </div>
                            <div className={cn("hidden sm:flex items-center justify-center p-1 rounded-md", event.sourceColor)}>
                              <SourceIcon className="size-3.5" />
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-14 shrink-0 flex justify-end">
                              <div className={cn("size-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0", event.senderInitialColor)}>
                                {event.senderInitial}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-semibold text-gray-900 truncate">{event.senderName}</span>
                                <span className="text-xs text-gray-500 truncate">{event.senderDetail}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex">
                            <div className="w-14 shrink-0" />
                            <div className="flex-1 min-w-0 pl-3">
                              <p className="text-sm font-semibold text-gray-900 leading-snug">{event.subject}</p>
                              <p className="text-xs text-gray-500 line-clamp-1">{event.body}</p>
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

        {/* Right — files panel */}
        <div className="w-full lg:w-72 xl:w-80 shrink-0">
          <div className="sticky top-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Files</h2>
            <FilesPanel />
          </div>
        </div>

      </div>
    </div>
  );
}
