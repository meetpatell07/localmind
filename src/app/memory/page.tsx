"use client";

import { useEffect, useState, useCallback } from "react";
import { ProfileCard } from "@/components/memory/profile-card";
import { EntityList } from "@/components/memory/entity-list";
import { GraphView } from "@/components/memory/graph-view";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search01Icon, Message01Icon, Clock01Icon } from "hugeicons-react";

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
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex flex-col h-full overflow-hidden gap-0"
    >
      {/* Header */}
      <div className="px-6 pt-5 pb-0 shrink-0">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="font-display italic text-2xl leading-none" style={{ color: "var(--amber)" }}>
              Memory
            </h1>
            <p className="text-sm opacity-25 mt-1">
              L1 episodic · L2 semantic · L3 entity graph · L4 profile
            </p>
          </div>
          {loading && <span className="text-sm opacity-30 animate-pulse mb-1">loading...</span>}
        </div>

        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="entities">
            Entities
            {entities.length > 0 && (
              <span className="ml-1.5 text-xs px-1 py-0.5 rounded-sm bg-muted">{entities.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="graph">Graph</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="recent">
            Recent
            {conversations.length > 0 && (
              <span className="ml-1.5 text-xs px-1 py-0.5 rounded-sm bg-muted">{conversations.length}</span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Graph tab: full bleed, no padding, no scroll */}
      <TabsContent value="graph" className="flex-1 overflow-hidden">
        <GraphView />
      </TabsContent>

      {/* Profile tab */}
      <TabsContent value="profile" className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <ProfileCard profile={profile} onRebuild={handleRebuild} rebuilding={rebuilding} />
        {decayStats && (
          <div
            className="rounded-sm px-4 py-3 space-y-2"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm tracking-widest uppercase opacity-40">Intelligent Decay</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={async () => {
                  await fetch("/api/memory?action=run-decay", { method: "POST" });
                  await load();
                }}
                className="opacity-30 hover:opacity-60 transition-opacity"
                style={{ color: "var(--amber)" }}
              >
                run cycle →
              </Button>
            </div>
            <div className="flex gap-4 text-sm">
              <span style={{ color: "#4ade80" }}>
                <span className="text-sm opacity-40 mr-1">sharp</span>{decayStats.active}
              </span>
              <span style={{ color: "#f59e0b" }}>
                <span className="text-sm opacity-40 mr-1">fading</span>{decayStats.fading}
              </span>
              <span style={{ color: "#ef4444" }}>
                <span className="text-sm opacity-40 mr-1">archived</span>{decayStats.archived}
              </span>
              <span className="opacity-25">
                <span className="text-sm mr-1">total</span>{decayStats.total}
              </span>
            </div>
            <div className="flex h-1 rounded-full overflow-hidden gap-px" style={{ background: "var(--line)" }}>
              {decayStats.total > 0 && (
                <>
                  <div className="h-full" style={{ width: `${(decayStats.active / decayStats.total) * 100}%`, background: "#4ade80" }} />
                  <div className="h-full" style={{ width: `${(decayStats.fading / decayStats.total) * 100}%`, background: "#f59e0b" }} />
                  <div className="h-full" style={{ width: `${(decayStats.archived / decayStats.total) * 100}%`, background: "#ef4444" }} />
                </>
              )}
            </div>
          </div>
        )}
      </TabsContent>

      {/* Entities tab */}
      <TabsContent value="entities" className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <EntityList entities={entities} />
      </TabsContent>

      {/* Search tab */}
      <TabsContent value="search" className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <form onSubmit={handleSearch}>
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              border: "1px solid",
              borderColor: searchQuery ? "rgba(240,160,21,0.3)" : "var(--line)",
              borderRadius: "3px",
              background: "var(--navy)",
              transition: "border-color 0.15s",
            }}
          >
            <Search01Icon className="h-4 w-4 shrink-0 opacity-30" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="semantic memory search..."
              className="flex-1 bg-transparent border-none h-auto p-0 focus:ring-0 focus:border-none placeholder:opacity-20"
              style={{ color: "hsl(210 18% 85%)" }}
            />
            <Button
              variant="ghost"
              size="xs"
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="disabled:opacity-20"
              style={{ color: "var(--amber)" }}
            >
              {searching ? "searching..." : "search →"}
            </Button>
          </div>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((result, i) => (
              <div key={i} className="px-4 py-3 rounded-sm" style={{ background: "var(--navy)", border: "1px solid var(--line)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Message01Icon className="h-3 w-3 opacity-30" />
                  <span className="text-sm opacity-30">result {i + 1}</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "hsl(210 18% 70%)" }}>
                  {result}
                </p>
              </div>
            ))}
          </div>
        )}

        {searchResults.length === 0 && searchQuery && !searching && (
          <p className="text-sm opacity-25 text-center py-8">no results</p>
        )}
      </TabsContent>

      {/* Recent tab */}
      <TabsContent value="recent" className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        <div className="rounded-sm overflow-hidden" style={{ border: "1px solid var(--line)" }}>
          <div
            className="flex items-center gap-2.5 px-4 py-3"
            style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--line)" }}
          >
            <Clock01Icon className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
            <span className="text-sm tracking-widest uppercase opacity-60">Recent Conversations</span>
          </div>
          <div style={{ background: "var(--navy)" }}>
            {conversations.length === 0 ? (
              <p className="text-sm opacity-25 text-center py-8">no conversations yet</p>
            ) : (
              conversations.map((msg, i) => (
                <div key={i} className="px-4 py-3 flex gap-3" style={{ borderBottom: "1px solid var(--line)" }}>
                  <span
                    className="text-sm shrink-0 pt-0.5 w-14 text-right opacity-50"
                    style={{ color: msg.role === "user" ? "var(--amber)" : "hsl(215 12% 55%)" }}
                  >
                    {msg.role}
                  </span>
                  <p className="text-sm leading-relaxed flex-1 min-w-0" style={{ color: "hsl(210 18% 72%)" }}>
                    {msg.content.length > 200 ? msg.content.slice(0, 200) + "…" : msg.content}
                  </p>
                  <span className="text-sm shrink-0 opacity-20 self-start">
                    {new Date(msg.createdAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
