"use client";

import { useEffect, useState, useCallback } from "react";
import { ProfileCard } from "@/components/memory/profile-card";
import { EntityList } from "@/components/memory/entity-list";
import { GraphView } from "@/components/memory/graph-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search01Icon,
  Message01Icon,
  Clock01Icon,
  UserIcon,
  NeuralNetworkIcon,
  GitBranchIcon,
  Search02Icon,
} from "hugeicons-react";
import { cn } from "@/lib/utils";

interface Entity {
  id: string;
  name: string;
  type: string;
  mentionCount: number | null;
  firstSeen: string;
  lastSeen: string;
  relationships: Array<{
    predicate: string;
    objectValue: string | null;
    confidence: number;
  }>;
}

interface Conversation {
  role: string;
  content: string;
  createdAt: string;
  channel: string | null;
}

const TABS = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "entities", label: "Entities", icon: NeuralNetworkIcon },
  { id: "graph", label: "Graph", icon: GitBranchIcon },
  { id: "search", label: "Search", icon: Search01Icon },
  { id: "recent", label: "Recent", icon: Clock01Icon },
];

export default function MemoryPage() {
  const [profile, setProfile] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [decayStats, setDecayStats] = useState<{ total: number; active: number; fading: number; archived: number } | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, entitiesRes, recentRes, decayRes] = await Promise.all([
        fetch("/api/memory?type=profile"),
        fetch("/api/memory?type=entities"),
        fetch("/api/memory?type=recent"),
        fetch("/api/memory?type=decay-stats"),
      ]);
      const [profileData, entitiesData, recentData, decayData] = await Promise.all([
        profileRes.json() as Promise<{ profile: string | null }>,
        entitiesRes.json() as Promise<{ entities: Entity[] }>,
        recentRes.json() as Promise<{ conversations: Conversation[] }>,
        decayRes.json() as Promise<{ total: number; active: number; fading: number; archived: number }>,
      ]);
      setProfile(profileData.profile);
      setEntities(entitiesData.entities ?? []);
      setConversations(recentData.conversations ?? []);
      setDecayStats(decayData);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/memory?type=search&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json() as { results: string[] };
      setSearchResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function handleRebuild() {
    setRebuilding(true);
    try {
      const res = await fetch("/api/memory?action=rebuild-profile", { method: "POST" });
      const data = await res.json() as { profile: string | null };
      setProfile(data.profile ?? null);
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-0 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Memory</h1>
            <p className="text-sm text-gray-500 mt-1">
              Episodic, semantic, entity graph &amp; profile layers.
            </p>
          </div>
          {loading && (
            <span className="text-xs font-medium text-gray-400 animate-pulse">Loading...</span>
          )}
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-6 border-b border-gray-100 overflow-x-auto no-scrollbar pb-px mb-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const count = tab.id === "entities" ? entities.length : tab.id === "recent" ? conversations.length : 0;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group flex items-center gap-2 pb-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                  isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    isActive ? "text-gray-900" : "text-gray-400 group-hover:text-gray-600"
                  )}
                />
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                  )}>
                    {count}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900 rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Graph tab: full bleed */}
      {activeTab === "graph" && (
        <div className="flex-1 overflow-hidden">
          <GraphView />
        </div>
      )}

      {/* Profile tab */}
      {activeTab === "profile" && (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
          <ProfileCard profile={profile} onRebuild={handleRebuild} rebuilding={rebuilding} />
          {decayStats && (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Intelligent Decay</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={async () => {
                    await fetch("/api/memory?action=run-decay", { method: "POST" });
                    await load();
                  }}
                  className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Run cycle
                </Button>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-gray-500 text-xs">Sharp</span>
                  <span className="font-semibold text-gray-900 text-xs">{decayStats.active}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-amber-500" />
                  <span className="text-gray-500 text-xs">Fading</span>
                  <span className="font-semibold text-gray-900 text-xs">{decayStats.fading}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-red-500" />
                  <span className="text-gray-500 text-xs">Archived</span>
                  <span className="font-semibold text-gray-900 text-xs">{decayStats.archived}</span>
                </span>
                <span className="flex items-center gap-1.5 ml-auto">
                  <span className="text-gray-400 text-xs">Total</span>
                  <span className="font-semibold text-gray-500 text-xs">{decayStats.total}</span>
                </span>
              </div>
              <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5 bg-gray-100">
                {decayStats.total > 0 && (
                  <>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(decayStats.active / decayStats.total) * 100}%` }} />
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${(decayStats.fading / decayStats.total) * 100}%` }} />
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${(decayStats.archived / decayStats.total) * 100}%` }} />
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entities tab */}
      {activeTab === "entities" && (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
          <EntityList entities={entities} />
        </div>
      )}

      {/* Search tab */}
      {activeTab === "search" && (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4">
          <form onSubmit={handleSearch}>
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border bg-white shadow-sm transition-all",
              searchQuery ? "border-gray-300 ring-1 ring-gray-200/50" : "border-gray-200"
            )}>
              <Search02Icon className="size-4 shrink-0 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search semantic memory..."
                className="flex-1 bg-transparent border-none h-auto p-0 text-sm text-gray-900 focus-visible:ring-0 placeholder:text-gray-400"
              />
              <Button
                variant="ghost"
                size="xs"
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="text-xs font-medium text-gray-900 hover:text-gray-700 disabled:text-gray-300"
              >
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
              {searchResults.map((result, i) => (
                <div key={i} className="p-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Message01Icon className="size-3 text-gray-400" />
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Result {i + 1}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-700">
                    {result}
                  </p>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <div className="text-center py-12">
              <Search01Icon className="size-8 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">No results found</p>
            </div>
          )}
        </div>
      )}

      {/* Recent tab */}
      {activeTab === "recent" && (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5">
          <div className="border border-gray-100 rounded-xl bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <Clock01Icon className="size-3.5 text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Conversations</span>
            </div>
            <div className="divide-y divide-gray-100">
              {conversations.length === 0 ? (
                <div className="py-12 text-center">
                  <Message01Icon className="size-8 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No conversations yet</p>
                </div>
              ) : (
                conversations.map((msg, i) => (
                  <div key={i} className="px-4 py-3 flex gap-3 hover:bg-gray-50/50 transition-colors">
                    <span className={cn(
                      "text-xs font-semibold shrink-0 pt-0.5 w-12 text-right",
                      msg.role === "user" ? "text-blue-600" : "text-gray-400"
                    )}>
                      {msg.role}
                    </span>
                    <p className="text-sm leading-relaxed flex-1 min-w-0 text-gray-700">
                      {msg.content.length > 200 ? msg.content.slice(0, 200) + "…" : msg.content}
                    </p>
                    <span className="text-[11px] shrink-0 text-gray-300 self-start font-medium">
                      {new Date(msg.createdAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
