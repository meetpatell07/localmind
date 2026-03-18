"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import type { GraphPayload } from "@/app/api/memory/graph/route";

// ── Self-contained dark canvas palette ────────────────────────────────────────
const CANVAS_BG   = "#06080f";
const PANEL_BG    = "#0d1220";
const PANEL_BORD  = "#1e2a3a";
const TEXT_DIM    = "#4b5c72";
const TEXT_MID    = "#7a90a8";
const TEXT_BRIGHT = "#c8d8e8";

const TYPE_PALETTE: Record<string, { ring: string; glow: string; badge: string; bg: string }> = {
  person:       { ring: "#22c55e", glow: "#22c55e33", badge: "#052e16", bg: "#021a0d" },
  project:      { ring: "#a855f7", glow: "#a855f733", badge: "#2e1065", bg: "#1a0635" },
  technology:   { ring: "#3b82f6", glow: "#3b82f633", badge: "#1e3a8a", bg: "#0a1a40" },
  organization: { ring: "#ef4444", glow: "#ef444433", badge: "#7f1d1d", bg: "#3b0d0d" },
  preference:   { ring: "#f59e0b", glow: "#f59e0b33", badge: "#78350f", bg: "#3a1a04" },
  concept:      { ring: "#06b6d4", glow: "#06b6d433", badge: "#164e63", bg: "#042a33" },
  event:        { ring: "#ec4899", glow: "#ec489933", badge: "#831843", bg: "#40091d" },
  other:        { ring: "#64748b", glow: "#64748b22", badge: "#1e293b", bg: "#0f172a" },
};

const ALL_TYPES = ["person","project","technology","organization","preference","concept","event","other"];

type NodeData = {
  label: string;
  type: string;
  mentionCount: number;
  decayScore: number;
  attributes: Record<string, string>;
  aliases: string[];
  summary: string | null;
  isValueNode: boolean;
  createdAt: string | null;
};

// ── Entity node ───────────────────────────────────────────────────────────────
function EntityNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const pal = TYPE_PALETTE[d.type] ?? TYPE_PALETTE.other;
  const decay = d.decayScore ?? 1;
  const decayPct = Math.round(decay * 100);
  const isFading = decay < 0.35;

  return (
    <div
      style={{
        background: pal.bg,
        border: `1.5px solid ${selected ? pal.ring : pal.ring + "88"}`,
        borderRadius: 8,
        padding: "8px 12px",
        minWidth: 110,
        maxWidth: 150,
        boxShadow: selected ? `0 0 18px ${pal.glow}, 0 0 6px ${pal.ring}44` : `0 0 8px ${pal.glow}`,
        opacity: Math.max(0.3, decay),
        transition: "box-shadow 0.2s, border-color 0.2s, opacity 0.4s",
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_BRIGHT, lineHeight: 1.3, wordBreak: "break-word" }}>
        {d.label}
      </div>
      <div style={{
        display: "inline-block", marginTop: 4, padding: "1px 6px",
        borderRadius: 99, fontSize: 9, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.08em",
        background: pal.badge, color: pal.ring,
      }}>
        {d.type}
      </div>
      {/* Decay bar */}
      <div style={{
        marginTop: 5, height: 2, borderRadius: 99,
        background: "rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 99,
          width: `${decayPct}%`,
          background: isFading ? "#ef4444" : pal.ring,
          transition: "width 0.5s",
        }} />
      </div>
      {d.mentionCount > 1 && (
        <div style={{ marginTop: 3, fontSize: 9, color: TEXT_DIM }}>
          {d.mentionCount}× mentioned
        </div>
      )}
    </div>
  );
}

// ── Value leaf node ───────────────────────────────────────────────────────────
function ValueNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <div style={{
      background: selected ? "#151f2e" : "#0d1420",
      border: `1px solid ${selected ? "#334155" : "#1e293b"}`,
      borderRadius: 99,
      padding: "3px 10px",
      maxWidth: 130,
      fontSize: 10,
      color: selected ? "#94a3b8" : "#4b5c72",
      cursor: "pointer",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      transition: "background 0.15s, border-color 0.15s",
    }}>
      {d.label}
    </div>
  );
}

const NODE_TYPES = { entityNode: EntityNode, valueNode: ValueNode };

// ── Node detail side panel ────────────────────────────────────────────────────
function DetailPanel({
  nodeId, allNodes, allEdges, onClose,
}: {
  nodeId: string;
  allNodes: Node[];
  allEdges: Edge[];
  onClose: () => void;
}) {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const d = node.data as NodeData;
  const pal = TYPE_PALETTE[d.type] ?? TYPE_PALETTE.other;

  const outgoing = allEdges.filter((e) => e.source === nodeId);
  const incoming = allEdges.filter((e) => e.target === nodeId);

  function nodeLabel(id: string) {
    const n = allNodes.find((x) => x.id === id);
    return n ? (n.data as NodeData).label : id;
  }

  const attrs = Object.entries(d.attributes ?? {}).filter(([, v]) => v);
  const decay = d.decayScore ?? 1;
  const decayPct = Math.round(decay * 100);
  const isFading = decay < 0.35;
  const decayColor = isFading ? "#ef4444" : decay < 0.7 ? "#f59e0b" : pal.ring;
  const decayLabel = isFading ? "Fading" : decay < 0.7 ? "Weakening" : "Strong";

  return (
    <div style={{
      position: "absolute", right: 12, top: 12, bottom: 12, width: 260,
      zIndex: 20, display: "flex", flexDirection: "column",
      background: PANEL_BG, border: `1px solid ${PANEL_BORD}`,
      borderRadius: 10, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px 10px", borderBottom: `1px solid ${PANEL_BORD}`,
        display: "flex", alignItems: "flex-start", gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: pal.ring, wordBreak: "break-word", lineHeight: 1.3 }}>
            {d.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{
              padding: "1px 7px", borderRadius: 99, fontSize: 9,
              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              background: pal.badge, color: pal.ring,
            }}>
              {d.type}
            </span>
            <span style={{ fontSize: 10, color: TEXT_DIM }}>{d.mentionCount}× mentioned</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: TEXT_DIM, fontSize: 16, lineHeight: 1, padding: 2,
            flexShrink: 0,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Memory strength */}
      <div style={{ padding: "10px 14px", borderBottom: `1px solid ${PANEL_BORD}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: TEXT_DIM }}>
            Memory Strength
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, color: decayColor }}>{decayLabel} · {decayPct}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 99, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 99, width: `${decayPct}%`,
            background: decayColor, transition: "width 0.5s",
          }} />
        </div>
        {d.createdAt && (
          <div style={{ marginTop: 5, fontSize: 9, color: TEXT_DIM }}>
            First seen {new Date(d.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
        {d.summary && (
          <Section label="Summary">
            <p style={{ fontSize: 11, lineHeight: 1.6, color: TEXT_MID }}>{d.summary}</p>
          </Section>
        )}

        {d.aliases?.length > 0 && (
          <Section label="Also known as">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {d.aliases.map((a) => (
                <span key={a} style={{
                  padding: "1px 7px", borderRadius: 99, fontSize: 10,
                  background: pal.badge, color: pal.ring, border: `1px solid ${pal.ring}33`,
                }}>
                  {a}
                </span>
              ))}
            </div>
          </Section>
        )}

        {attrs.length > 0 && (
          <Section label="Attributes">
            {attrs.map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: TEXT_DIM, flexShrink: 0 }}>{k}</span>
                <span style={{ color: TEXT_MID, wordBreak: "break-word" }}>{String(v)}</span>
              </div>
            ))}
          </Section>
        )}

        {outgoing.length > 0 && (
          <Section label={`→ Outgoing (${outgoing.length})`}>
            {outgoing.map((e) => (
              <RelRow key={e.id} label={String(e.label)} target={nodeLabel(e.target)} color={pal.ring} />
            ))}
          </Section>
        )}

        {incoming.length > 0 && (
          <Section label={`← Incoming (${incoming.length})`}>
            {incoming.map((e) => (
              <RelRow key={e.id} label={String(e.label)} target={nodeLabel(e.source)} color={TEXT_MID} />
            ))}
          </Section>
        )}

        {!d.summary && attrs.length === 0 && outgoing.length === 0 && incoming.length === 0 && (
          <p style={{ fontSize: 11, color: TEXT_DIM, fontStyle: "italic" }}>No details yet — keep chatting!</p>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.1em", color: TEXT_DIM, marginBottom: 5,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function RelRow({ label, target, color }: { label: string; target: string; color: string }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11, marginBottom: 3 }}>
      <span style={{ color: TEXT_DIM, flexShrink: 0, fontStyle: "italic" }}>{label}</span>
      <span style={{ color, wordBreak: "break-word" }}>{target}</span>
    </div>
  );
}

// ── Type filter bar ────────────────────────────────────────────────────────────
function TypeFilter({
  activeTypes, counts, onChange,
}: {
  activeTypes: Set<string>;
  counts: Record<string, number>;
  onChange: (s: Set<string>) => void;
}) {
  function toggle(t: string) {
    const next = new Set(activeTypes);
    if (next.has(t)) next.delete(t); else next.add(t);
    onChange(next);
  }

  return (
    <div style={{
      position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 10, display: "flex", alignItems: "center", gap: 4,
      padding: "6px 10px", borderRadius: 8,
      background: PANEL_BG, border: `1px solid ${PANEL_BORD}`,
      flexWrap: "wrap", justifyContent: "center", maxWidth: "70vw",
    }}>
      {ALL_TYPES.filter((t) => (counts[t] ?? 0) > 0).map((t) => {
        const pal = TYPE_PALETTE[t] ?? TYPE_PALETTE.other;
        const active = activeTypes.size === 0 || activeTypes.has(t);
        return (
          <button
            key={t}
            onClick={() => toggle(t)}
            style={{
              padding: "2px 9px", borderRadius: 99, fontSize: 9,
              fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
              cursor: "pointer",
              background: active ? pal.badge : "transparent",
              border: `1px solid ${active ? pal.ring + "88" : PANEL_BORD}`,
              color: active ? pal.ring : TEXT_DIM,
              transition: "all 0.15s",
            }}
          >
            {t} <span style={{ opacity: 0.6 }}>{counts[t]}</span>
          </button>
        );
      })}
      {activeTypes.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          style={{
            padding: "2px 8px", borderRadius: 99, fontSize: 9,
            background: "none", border: `1px solid ${PANEL_BORD}`,
            color: TEXT_DIM, cursor: "pointer",
          }}
        >
          clear ×
        </button>
      )}
    </div>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({
  value, onChange, onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{
      position: "absolute", top: 12, left: 12, zIndex: 10,
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 8,
      background: PANEL_BG, border: `1px solid ${PANEL_BORD}`,
      width: 180,
    }}>
      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={TEXT_DIM} strokeWidth={2}>
        <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-5-5" />
      </svg>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search nodes…"
        style={{
          background: "none", border: "none", outline: "none",
          color: TEXT_BRIGHT, fontSize: 11, width: "100%",
        }}
      />
      {value && (
        <button onClick={onClear} style={{ background: "none", border: "none", color: TEXT_DIM, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

// ── Stats bar ────────────────────────────────────────────────────────────────
function StatsBar({
  nodeCount, edgeCount, visibleCount, onRefresh,
}: {
  nodeCount: number; edgeCount: number; visibleCount: number; onRefresh: () => void;
}) {
  return (
    <div style={{
      position: "absolute", top: 12, right: 12, zIndex: 10,
      display: "flex", alignItems: "center", gap: 10,
      padding: "5px 12px", borderRadius: 8,
      background: PANEL_BG, border: `1px solid ${PANEL_BORD}`,
      fontSize: 11,
    }}>
      <span style={{ color: "#f59e0b", fontWeight: 600 }}>{visibleCount}</span>
      <span style={{ color: TEXT_DIM }}>/ {nodeCount} nodes</span>
      <span style={{ color: PANEL_BORD }}>·</span>
      <span style={{ color: TEXT_DIM }}>{edgeCount} edges</span>
      <button
        onClick={onRefresh}
        style={{
          background: "none", border: "none", color: TEXT_DIM,
          cursor: "pointer", fontSize: 14, lineHeight: 1, marginLeft: 2,
          transition: "color 0.15s",
        }}
        title="Refresh graph"
      >
        ↺
      </button>
    </div>
  );
}

// ── Time machine slider ───────────────────────────────────────────────────────
function TimeMachineSlider({
  value, min, max, visibleCount, totalCount, onChange,
}: {
  value: number; min: number; max: number;
  visibleCount: number; totalCount: number;
  onChange: (v: number) => void;
}) {
  const isLive = value >= max - 60_000;
  const pct = max === min ? 100 : ((value - min) / (max - min)) * 100;
  const label = isLive
    ? "Live"
    : new Date(value).toLocaleDateString([], {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

  return (
    <div style={{
      position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
      zIndex: 10, padding: "8px 14px",
      background: PANEL_BG, border: `1px solid ${PANEL_BORD}`,
      borderRadius: 8, minWidth: 280, maxWidth: "clamp(280px, 48vw, 480px)", width: "100%",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_DIM }}>
            Time Machine
          </span>
          {!isLive && (
            <span style={{ fontSize: 9, color: TEXT_DIM }}>
              · {visibleCount}/{totalCount} nodes
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: isLive ? "#22c55e" : "#f59e0b",
          }}>
            {label}
          </span>
          {isLive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />}
          {!isLive && (
            <button
              onClick={() => onChange(max)}
              style={{
                padding: "1px 6px", borderRadius: 4, fontSize: 9,
                background: "none", border: `1px solid ${PANEL_BORD}`,
                color: TEXT_DIM, cursor: "pointer",
              }}
            >
              ↺ live
            </button>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, color: TEXT_DIM, flexShrink: 0 }}>
          {new Date(min).toLocaleDateString([], { month: "short", year: "2-digit" })}
        </span>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            step={15 * 60 * 1000}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{
              width: "100%", cursor: "pointer", appearance: "none",
              height: 3, borderRadius: 99, outline: "none",
              background: `linear-gradient(to right, #f59e0b ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
            }}
          />
        </div>
        <span style={{ fontSize: 9, color: TEXT_DIM, flexShrink: 0 }}>now</span>
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const entries = Object.entries(TYPE_PALETTE).filter(([k]) => k !== "other");
  return (
    <div style={{
      position: "absolute", bottom: 76, left: 12, zIndex: 10,
      padding: "8px 12px", borderRadius: 8,
      background: PANEL_BG, border: `1px solid ${PANEL_BORD}`,
    }}>
      {entries.map(([type, pal]) => (
        <div key={type} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: pal.ring, flexShrink: 0 }} />
          <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: pal.ring }}>{type}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function GraphView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawNodes, setRawNodes] = useState<Node[]>([]);
  const [rawEdges, setRawEdges] = useState<Edge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState(0);

  // Time machine
  const nowMs = Date.now();
  const [timeRange, setTimeRange] = useState({ min: nowMs - 30 * 86400_000, max: nowMs });
  const [sliderMs, setSliderMs] = useState(nowMs);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GraphPayload;

      // Map nodes
      const mappedNodes: Node[] = data.nodes.map((n) => ({
        id:       n.id,
        type:     n.type,
        position: n.position,
        data:     n.data,
      }));

      // Map edges with visible colors
      const mappedEdges: Edge[] = data.edges.map((e) => {
        const conf = e.data.confidence ?? 0.8;
        const srcData = data.nodes.find((n) => n.id === e.source)?.data;
        const pal = srcData ? (TYPE_PALETTE[srcData.type] ?? TYPE_PALETTE.other) : TYPE_PALETTE.other;
        return {
          id:       e.id,
          source:   e.source,
          target:   e.target,
          label:    e.label,
          animated: conf >= 0.95,
          style: {
            stroke:      conf >= 0.9 ? pal.ring + "99" : "#334155",
            strokeWidth: conf >= 0.9 ? 1.5 : 1,
          },
          labelStyle: { fill: "#4b5c72", fontSize: 9, fontFamily: "monospace" },
          labelBgStyle: { fill: CANVAS_BG, fillOpacity: 0.85 },
          data: e.data,
        };
      });

      setRawNodes(mappedNodes);
      setRawEdges(mappedEdges);

      // Compute type counts
      const counts: Record<string, number> = {};
      data.nodes.forEach((n) => {
        if (!n.data.isValueNode) {
          counts[n.data.type] = (counts[n.data.type] ?? 0) + 1;
        }
      });
      setTypeCounts(counts);

      // Time range
      const tss = data.nodes
        .map((n) => n.data.createdAt ? new Date(n.data.createdAt).getTime() : null)
        .filter((t): t is number => t !== null && !isNaN(t));
      const now = Date.now();
      if (tss.length > 0) {
        setTimeRange({ min: Math.min(...tss), max: now });
      }
      setSliderMs(now);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Combined filter: type + time + search ─────────────────────────────────
  useEffect(() => {
    const isTimeMachine = sliderMs < timeRange.max - 60_000;
    const FADE_WINDOW = 30 * 86400_000;

    // Step 1: time filter
    let vNodes = isTimeMachine
      ? rawNodes
          .filter((n) => {
            const d = n.data as NodeData;
            if (!d.createdAt) return true;
            return new Date(d.createdAt).getTime() <= sliderMs;
          })
          .map((n) => {
            const d = n.data as NodeData;
            if (!d.createdAt) return n;
            const age = sliderMs - new Date(d.createdAt).getTime();
            const factor = Math.min(1, age / FADE_WINDOW);
            return {
              ...n,
              style: { opacity: Math.max(0.3, (d.decayScore ?? 1) * (0.3 + 0.7 * factor)) },
            };
          })
      : rawNodes;

    let vEdges = isTimeMachine
      ? rawEdges.filter((e) => {
          const vf = e.data?.validFrom as string | null | undefined;
          if (vf && new Date(vf).getTime() > sliderMs) return false;
          return true;
        })
      : rawEdges;

    const nodeIdSet = new Set(vNodes.map((n) => n.id));
    vEdges = vEdges.filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));

    // Step 2: type filter
    if (activeTypes.size > 0) {
      const kept = new Set(
        vNodes
          .filter((n) => {
            const type = (n.data as NodeData).type;
            return activeTypes.has(type) || type === "value";
          })
          .map((n) => n.id),
      );
      vNodes = vNodes.filter((n) => kept.has(n.id));
      vEdges = vEdges.filter((e) => kept.has(e.source) && kept.has(e.target));
    }

    // Step 3: search highlight (dim everything else)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      vNodes = vNodes.map((n) => {
        const label = ((n.data as NodeData).label ?? "").toLowerCase();
        const matches = label.includes(q);
        return {
          ...n,
          style: {
            ...(n.style ?? {}),
            opacity: matches ? 1 : 0.12,
          },
        };
      });
      const highlighted = new Set(
        vNodes
          .filter((n) => {
            const label = ((n.data as NodeData).label ?? "").toLowerCase();
            return label.includes(q);
          })
          .map((n) => n.id),
      );
      vEdges = vEdges.map((e) => ({
        ...e,
        style: {
          ...(e.style ?? {}),
          opacity: highlighted.has(e.source) || highlighted.has(e.target) ? 1 : 0.05,
        },
      }));
    }

    setVisibleCount(vNodes.length);
    setNodes(vNodes);
    setEdges(vEdges);
  }, [rawNodes, rawEdges, activeTypes, sliderMs, timeRange, search, setNodes, setEdges]);

  const hasTimeRange = timeRange.max - timeRange.min > 86400_000;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", background: CANVAS_BG,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 32, height: 32, border: `2px solid ${PANEL_BORD}`,
            borderTopColor: "#f59e0b", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
          }} />
          <p style={{ fontSize: 12, color: TEXT_DIM }}>Loading knowledge graph…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", background: CANVAS_BG, gap: 12,
      }}>
        <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>
        <button
          onClick={load}
          style={{
            padding: "6px 16px", borderRadius: 6, fontSize: 12,
            background: "none", border: `1px solid ${PANEL_BORD}`,
            color: "#f59e0b", cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (rawNodes.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", background: CANVAS_BG, gap: 8,
      }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>◎</div>
        <p style={{ fontSize: 13, color: TEXT_DIM }}>No entities yet</p>
        <p style={{ fontSize: 11, color: TEXT_DIM, opacity: 0.6 }}>
          Start chatting — the AI will build your knowledge graph automatically.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Controls overlay */}
      <SearchBar value={search} onChange={setSearch} onClear={() => setSearch("")} />
      <TypeFilter activeTypes={activeTypes} counts={typeCounts} onChange={setActiveTypes} />
      <StatsBar
        nodeCount={rawNodes.length}
        edgeCount={rawEdges.length}
        visibleCount={visibleCount}
        onRefresh={load}
      />

      {/* React Flow canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.08}
        maxZoom={3}
        style={{ background: CANVAS_BG }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) =>
          setSelectedId((prev) => (prev === node.id ? null : node.id))
        }
        onPaneClick={() => { setSelectedId(null); }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#ffffff08"
        />
        <Controls
          style={{
            background: PANEL_BG,
            border: `1px solid ${PANEL_BORD}`,
            borderRadius: 8,
          }}
        />
        <MiniMap
          style={{
            background: PANEL_BG,
            border: `1px solid ${PANEL_BORD}`,
            borderRadius: 8,
          }}
          nodeColor={(n) => {
            const type = (n.data as NodeData)?.type ?? "other";
            return TYPE_PALETTE[type]?.ring ?? "#475569";
          }}
          maskColor="rgba(6,8,15,0.75)"
        />
      </ReactFlow>

      {/* Legend */}
      <Legend />

      {/* Time machine slider */}
      {hasTimeRange && (
        <TimeMachineSlider
          value={sliderMs}
          min={timeRange.min}
          max={timeRange.max}
          visibleCount={visibleCount}
          totalCount={rawNodes.length}
          onChange={setSliderMs}
        />
      )}

      {/* Node detail panel */}
      {selectedId && (
        <DetailPanel
          nodeId={selectedId}
          allNodes={rawNodes}
          allEdges={rawEdges}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Inline keyframes for spinner and pulse */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        .react-flow__controls button {
          background: ${PANEL_BG} !important;
          border-color: ${PANEL_BORD} !important;
          color: ${TEXT_MID} !important;
          fill: ${TEXT_MID} !important;
        }
        .react-flow__controls button:hover {
          background: ${PANEL_BORD} !important;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 13px; height: 13px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          box-shadow: 0 0 6px #f59e0b66;
        }
        input[type="range"]::-moz-range-thumb {
          width: 13px; height: 13px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
