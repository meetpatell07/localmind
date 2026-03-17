"use client";

import { useState } from "react";
import { NeuralNetworkIcon, ArrowDown01Icon, ArrowRight01Icon } from "hugeicons-react";

interface Relationship {
  predicate: string;
  objectValue: string | null;
  confidence: number;
}

interface Entity {
  id: string;
  name: string;
  type: string;
  mentionCount: number | null;
  firstSeen: string;
  lastSeen: string;
  relationships: Relationship[];
}

interface EntityListProps {
  entities: Entity[];
}

const TYPE_COLORS: Record<string, string> = {
  person:      "rgba(96, 165, 250, 0.7)",
  project:     "rgba(240, 160, 21, 0.7)",
  technology:  "rgba(167, 243, 208, 0.7)",
  concept:     "rgba(196, 181, 253, 0.7)",
  place:       "rgba(253, 186, 116, 0.7)",
  organization:"rgba(251, 191, 36, 0.7)",
  event:       "rgba(248, 113, 113, 0.7)",
  other:       "rgba(148, 163, 184, 0.5)",
};

export function EntityList({ entities }: EntityListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const filtered = entities.filter(
    (e) =>
      !filter ||
      e.name.toLowerCase().includes(filter.toLowerCase()) ||
      e.type.toLowerCase().includes(filter.toLowerCase())
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  return (
    <div
      className="rounded-sm overflow-hidden"
      style={{ border: "1px solid var(--line)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "var(--surface-raised)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center gap-2.5">
          <NeuralNetworkIcon className="h-3.5 w-3.5" style={{ color: "var(--amber)" }} />
          <span className="text-sm tracking-widest uppercase opacity-60">
            Entities
          </span>
          <span
            className="text-sm px-1.5 py-0.5 rounded-sm"
            style={{ background: "var(--amber-dim)", color: "var(--amber)" }}
          >
            {entities.length}
          </span>
        </div>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="filter..."
          className="bg-transparent text-sm outline-none placeholder:opacity-20 text-right w-24"
          style={{ color: "hsl(210 18% 70%)" }}
        />
      </div>

      {/* Table */}
      <div style={{ background: "var(--navy)" }}>
        {filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm opacity-25">
              {filter ? "no matches" : "no entities yet — start chatting"}
            </p>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div
              className="grid px-4 py-2 text-sm tracking-widest uppercase"
              style={{
                gridTemplateColumns: "1fr 80px 50px",
                color: "hsl(215 12% 40%)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span>Name / Type</span>
              <span className="text-right">Last Seen</span>
              <span className="text-right">Mentions</span>
            </div>

            {filtered.map((entity) => {
              const isOpen = expanded.has(entity.id);
              const typeColor = TYPE_COLORS[entity.type] ?? TYPE_COLORS.other;

              return (
                <div key={entity.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  {/* Row */}
                  <button
                    className="w-full text-left grid px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                    style={{ gridTemplateColumns: "1fr 80px 50px" }}
                    onClick={() => toggle(entity.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {entity.relationships.length > 0
                        ? isOpen
                          ? <ArrowDown01Icon className="h-3 w-3 shrink-0 opacity-30" />
                          : <ArrowRight01Icon className="h-3 w-3 shrink-0 opacity-30" />
                        : <span className="w-3 shrink-0" />
                      }
                      <span
                        className="text-sm truncate"
                        style={{ color: "hsl(210 18% 85%)" }}
                      >
                        {entity.name}
                      </span>
                      <span
                        className="text-sm px-1.5 py-0.5 rounded-sm shrink-0"
                        style={{
                          background: `${typeColor.replace("0.7", "0.1")}`,
                          color: typeColor,
                          border: `1px solid ${typeColor.replace("0.7", "0.2")}`,
                        }}
                      >
                        {entity.type}
                      </span>
                    </div>
                    <span
                      className="text-sm text-right self-center opacity-30"
                    >
                      {new Date(entity.lastSeen).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    </span>
                    <span
                      className="text-sm text-right self-center"
                      style={{ color: "var(--amber)", opacity: 0.7 }}
                    >
                      {entity.mentionCount ?? 1}
                    </span>
                  </button>

                  {/* Relationships */}
                  {isOpen && entity.relationships.length > 0 && (
                    <div
                      className="px-10 py-2 space-y-1"
                      style={{ background: "rgba(255,255,255,0.01)", borderTop: "1px solid var(--line)" }}
                    >
                      {entity.relationships.map((rel, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="opacity-25">↳</span>
                          <span style={{ color: "hsl(215 12% 50%)" }}>{rel.predicate}</span>
                          <span className="opacity-20">·</span>
                          <span style={{ color: "hsl(210 18% 75%)" }}>{rel.objectValue}</span>
                          <span
                            className="ml-auto opacity-20 text-sm"
                          >
                            {Math.round((rel.confidence ?? 0.8) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
