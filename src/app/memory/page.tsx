"use client";

import { useEffect, useState, useCallback } from "react";
import { ProfileCard } from "@/frontend/components/memory/profile-card";
import { EntityList } from "@/frontend/components/memory/entity-list";
import { Search, MessageSquare, Clock } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"profile" | "entities" | "search" | "recent">("profile");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, entitiesRes, recentRes] = await Promise.all([
        fetch("/api/memory?type=profile"),
        fetch("/api/memory?type=entities"),
        fetch("/api/memory?type=recent"),
      ]);
      const [profileData, entitiesData, recentData] = await Promise.all([
        profileRes.json() as Promise<{ profile: string | null }>,
        entitiesRes.json() as Promise<{ entities: Entity[] }>,
        recentRes.json() as Promise<{ conversations: Conversation[] }>,
      ]);
      setProfile(profileData.profile);
      setEntities(entitiesData.entities ?? []);
      setConversations(recentData.conversations ?? []);
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

  const tabs = [
    { key: "profile"  as const, label: "Profile",  num: "01" },
    { key: "entities" as const, label: "Entities", num: "02", count: entities.length },
    { key: "search"   as const, label: "Search",   num: "03" },
    { key: "recent"   as const, label: "Recent",   num: "04", count: conversations.length },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-0 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h1 className="font-display italic text-2xl leading-none" style={{ color: "var(--amber)" }}>
              Memory
            </h1>
            <p className="font-mono text-[10px] opacity-25 mt-1">
              L1 episodic · L2 semantic · L3 entity graph · L4 profile
            </p>
          </div>
          {loading && <span className="font-mono text-[10px] opacity-30 animate-pulse mb-1">loading...</span>}
        </div>

        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2.5 font-mono text-[11px] transition-all"
              style={
                activeTab === tab.key
                  ? { color: "var(--amber)", borderBottom: "2px solid var(--amber)", marginBottom: "-1px" }
                  : { color: "hsl(215 12% 45%)", borderBottom: "2px solid transparent", marginBottom: "-1px" }
              }
            >
              <span className="opacity-30 text-[9px]">{tab.num}</span>
              {tab.label}
              {"count" in tab && tab.count != null && tab.count > 0 && (
                <span
                  className="text-[9px] px-1 py-0.5 rounded-sm"
                  style={{
                    background: activeTab === tab.key ? "var(--amber-dim)" : "rgba(255,255,255,0.04)",
                    color: activeTab === tab.key ? "var(--amber)" : "hsl(215 12% 45%)",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {activeTab === "profile" && (
          <ProfileCard profile={profile} onRebuild={handleRebuild} rebuilding={rebuilding} />
        )}

        {activeTab === "entities" && (
          <EntityList entities={entities} />
        )}

        {activeTab === "search" && (
          <div className="space-y-4">
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
                <Search className="h-4 w-4 shrink-0 opacity-30" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="semantic memory search..."
                  className="flex-1 bg-transparent font-mono text-sm outline-none placeholder:opacity-20"
                  style={{ color: "hsl(210 18% 85%)" }}
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="font-mono text-[10px] disabled:opacity-20"
                  style={{ color: "var(--amber)" }}
                >
                  {searching ? "searching..." : "search →"}
                </button>
              </div>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((result, i) => (
                  <div key={i} className="px-4 py-3 rounded-sm" style={{ background: "var(--navy)", border: "1px solid var(--line)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3 w-3 opacity-30" />
                      <span className="font-mono text-[9px] opacity-30">result {i + 1}</span>
                    </div>
                    <p className="font-mono text-[12px] leading-relaxed" style={{ color: "hsl(210 18% 70%)" }}>
                      {result}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p className="font-mono text-[11px] opacity-25 text-center py-8">no results</p>
            )}
          </div>
        )}

        {activeTab === "recent" && (
          <div className="rounded-sm overflow-hidden" style={{ border: "1px solid var(--line)" }}>
            <div
              className="flex items-center gap-2.5 px-4 py-3"
              style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--line)" }}
            >
              <Clock className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
              <span className="font-mono text-[11px] tracking-widest uppercase opacity-60">Recent Conversations</span>
            </div>
            <div style={{ background: "var(--navy)" }}>
              {conversations.length === 0 ? (
                <p className="font-mono text-[11px] opacity-25 text-center py-8">no conversations yet</p>
              ) : (
                conversations.map((msg, i) => (
                  <div key={i} className="px-4 py-3 flex gap-3" style={{ borderBottom: "1px solid var(--line)" }}>
                    <span
                      className="font-mono text-[9px] shrink-0 pt-0.5 w-14 text-right opacity-50"
                      style={{ color: msg.role === "user" ? "var(--amber)" : "hsl(215 12% 55%)" }}
                    >
                      {msg.role}
                    </span>
                    <p className="font-mono text-[12px] leading-relaxed flex-1 min-w-0" style={{ color: "hsl(210 18% 72%)" }}>
                      {msg.content.length > 200 ? msg.content.slice(0, 200) + "…" : msg.content}
                    </p>
                    <span className="font-mono text-[9px] shrink-0 opacity-20 self-start">
                      {new Date(msg.createdAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
