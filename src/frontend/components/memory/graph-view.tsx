"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { X } from "lucide-react";
import type { GraphPayload } from "@/app/api/memory/graph/route";

// ── Colour palette by entity type ─────────────────────────────────────────────
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  person:       { bg: "#0f2d1a", border: "#22c55e", text: "#4ade80" },
  project:      { bg: "#1e0a2e", border: "#a855f7", text: "#c084fc" },
  technology:   { bg: "#0a1a2e", border: "#3b82f6", text: "#60a5fa" },
  organization: { bg: "#1a0a0a", border: "#ef4444", text: "#f87171" },
  preference:   { bg: "#1a1200", border: "#f59e0b", text: "#fbbf24" },
  concept:      { bg: "#0a1a1a", border: "#06b6d4", text: "#22d3ee" },
  event:        { bg: "#1a0a1a", border: "#ec4899", text: "#f472b6" },
  value:        { bg: "#0d0d14", border: "#334155", text: "#64748b" },
  other:        { bg: "#111320", border: "#475569", text: "#94a3b8" },
};

const ALL_ENTITY_TYPES = ["person", "project", "technology", "organization", "preference", "concept", "event", "other"];

type NodeData = {
  label: string;
  type: string;
  mentionCount: number;
  decayScore: number;
  attributes: Record<string, string>;
  aliases: string[];
  summary: string | null;
  isValueNode: boolean;
};

// ── Custom entity node ─────────────────────────────────────────────────────────
function EntityNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const colors  = TYPE_COLORS[d.type] ?? TYPE_COLORS.other;
  const decay    = d.decayScore ?? 1.0;
  const opacity  = Math.max(0.25, decay);
  const decayPct = Math.round(decay * 100);
  const isSharp  = decay >= 0.7;
  const isFading = decay < 0.35;

  return (
    <div
      className="px-3 py-2 rounded-sm font-mono text-[11px] max-w-[140px] text-center cursor-pointer"
      style={{
        background: colors.bg,
        border: `1px solid ${selected ? colors.text : colors.border}`,
        color: colors.text,
        boxShadow: selected
          ? `0 0 16px ${colors.border}88`
          : `0 0 8px ${colors.border}${isSharp ? "44" : "11"}`,
        opacity,
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
    >
      <div className="font-semibold leading-tight truncate">{d.label}</div>
      <div className="text-[9px] opacity-40 mt-0.5 uppercase tracking-widest">
        {d.type} · {d.mentionCount}×
      </div>
      <div className="mt-1.5 h-0.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${decayPct}%`,
            background: isFading ? "#ef4444" : isSharp ? colors.border : "#f59e0b",
          }}
        />
      </div>
    </div>
  );
}

// ── Value leaf node — compact pill ─────────────────────────────────────────────
function ValueNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <div
      className="px-2 py-1 rounded-full font-mono text-[10px] max-w-[120px] truncate cursor-pointer"
      style={{
        background: selected ? "#1e2030" : "#0d0d14",
        border: `1px solid ${selected ? "#475569" : "#1e2535"}`,
        color: "#4b5563",
        boxShadow: selected ? "0 0 8px #33415544" : "none",
      }}
    >
      {d.label}
    </div>
  );
}

const NODE_TYPES = { entityNode: EntityNode, valueNode: ValueNode };

// ── Node detail panel ──────────────────────────────────────────────────────────
function NodeDetailPanel({
  nodeId,
  allNodes,
  allEdges,
  onClose,
}: {
  nodeId: string;
  allNodes: Node[];
  allEdges: Edge[];
  onClose: () => void;
}) {
  const node = allNodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const d = node.data as NodeData;
  const colors = TYPE_COLORS[d.type] ?? TYPE_COLORS.other;

  const outgoing = allEdges.filter((e) => e.source === nodeId);
  const incoming = allEdges.filter((e) => e.target === nodeId);

  function getLabel(id: string) {
    return allNodes.find((n) => n.id === id)?.data
      ? (allNodes.find((n) => n.id === id)!.data as NodeData).label
      : id;
  }

  const attrs = Object.entries(d.attributes ?? {}).filter(([, v]) => v);

  return (
    <div
      className="absolute right-3 top-3 bottom-3 w-60 z-20 flex flex-col overflow-hidden rounded-sm"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      {/* Header */}
      <div
        className="flex items-start justify-between px-3 pt-3 pb-2"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="font-mono text-[12px] font-semibold truncate"
            style={{ color: colors.text }}
          >
            {d.label}
          </div>
          <div className="font-mono text-[9px] opacity-40 uppercase tracking-widest mt-0.5">
            {d.type}
            {!d.isValueNode && ` · ${d.mentionCount}×`}
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 ml-2 opacity-30 hover:opacity-70 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Summary */}
        {d.summary && (
          <div>
            <div className="font-mono text-[9px] opacity-30 uppercase tracking-widest mb-1">summary</div>
            <p className="font-mono text-[10px] leading-relaxed" style={{ color: "hsl(210 18% 65%)" }}>
              {d.summary}
            </p>
          </div>
        )}

        {/* Aliases */}
        {d.aliases?.length > 0 && (
          <div>
            <div className="font-mono text-[9px] opacity-30 uppercase tracking-widest mb-1">also known as</div>
            <div className="flex flex-wrap gap-1">
              {d.aliases.map((a) => (
                <span
                  key={a}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded-sm"
                  style={{ background: `${colors.bg}`, border: `1px solid ${colors.border}33`, color: colors.text }}
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attributes */}
        {attrs.length > 0 && (
          <div>
            <div className="font-mono text-[9px] opacity-30 uppercase tracking-widest mb-1">attributes</div>
            <div className="space-y-1">
              {attrs.map(([k, v]) => (
                <div key={k} className="flex gap-1.5 font-mono text-[10px]">
                  <span className="opacity-40 shrink-0">{k}</span>
                  <span className="truncate" style={{ color: "hsl(210 18% 70%)" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outgoing relationships */}
        {outgoing.length > 0 && (
          <div>
            <div className="font-mono text-[9px] opacity-30 uppercase tracking-widest mb-1">relationships →</div>
            <div className="space-y-1">
              {outgoing.map((e) => (
                <div key={e.id} className="flex gap-1.5 font-mono text-[10px] items-start">
                  <span className="opacity-40 shrink-0">{String(e.label)}</span>
                  <span className="truncate" style={{ color: colors.text }}>{getLabel(e.target)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incoming relationships */}
        {incoming.length > 0 && (
          <div>
            <div className="font-mono text-[9px] opacity-30 uppercase tracking-widest mb-1">← referenced by</div>
            <div className="space-y-1">
              {incoming.map((e) => (
                <div key={e.id} className="flex gap-1.5 font-mono text-[10px] items-start">
                  <span className="truncate" style={{ color: "hsl(210 18% 70%)" }}>{getLabel(e.source)}</span>
                  <span className="opacity-40 shrink-0">{String(e.label)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {outgoing.length === 0 && incoming.length === 0 && attrs.length === 0 && (
          <div className="font-mono text-[10px] opacity-25">no details yet</div>
        )}
      </div>
    </div>
  );
}

// ── Type filter bar ────────────────────────────────────────────────────────────
function TypeFilterBar({
  activeTypes,
  onChange,
}: {
  activeTypes: Set<string>;
  onChange: (t: Set<string>) => void;
}) {
  function toggle(type: string) {
    const next = new Set(activeTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onChange(next);
  }

  return (
    <div
      className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-2 py-1.5 rounded-sm"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      {ALL_ENTITY_TYPES.map((type) => {
        const colors  = TYPE_COLORS[type] ?? TYPE_COLORS.other;
        const isActive = activeTypes.size === 0 || activeTypes.has(type);
        return (
          <button
            key={type}
            onClick={() => toggle(type)}
            className="font-mono text-[9px] px-1.5 py-0.5 rounded-sm transition-all uppercase tracking-widest"
            style={{
              background: isActive ? colors.bg : "transparent",
              border: `1px solid ${isActive ? colors.border : "transparent"}`,
              color: isActive ? colors.text : "rgba(255,255,255,0.2)",
            }}
          >
            {type}
          </button>
        );
      })}
      {activeTypes.size > 0 && (
        <button
          onClick={() => onChange(new Set())}
          className="font-mono text-[9px] opacity-30 hover:opacity-60 ml-1 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const entries = Object.entries(TYPE_COLORS).filter(([k]) => k !== "value" && k !== "other");
  return (
    <div
      className="absolute bottom-4 left-4 z-10 p-3 rounded-sm font-mono text-[10px] space-y-1"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      {entries.map(([type, colors]) => (
        <div key={type} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.border }} />
          <span style={{ color: colors.text }}>{type}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function GraphView() {
  const [nodes,     setNodes,     onNodesChange] = useNodesState<Node>([]);
  const [edges,     setEdges,     onEdgesChange] = useEdgesState<Edge>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [activeTypes,  setActiveTypes]  = useState<Set<string>>(new Set());

  // All raw nodes/edges — used for filtering without re-fetching
  const [rawNodes, setRawNodes] = useState<Node[]>([]);
  const [rawEdges, setRawEdges] = useState<Edge[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GraphPayload;

      const mappedNodes: Node[] = data.nodes.map((n) => ({
        id:       n.id,
        type:     n.type,
        position: n.position,
        data:     n.data,
      }));

      const mappedEdges: Edge[] = data.edges.map((e) => ({
        id:       e.id,
        source:   e.source,
        target:   e.target,
        label:    e.label,
        animated: e.animated,
        style: {
          stroke:      (e.data.confidence ?? 0.8) >= 0.9 ? "#4ade8055" : "#33415555",
          strokeWidth: (e.data.confidence ?? 0.8) >= 0.9 ? 1.5 : 1,
        },
        labelStyle: {
          fill:       "#64748b",
          fontSize:   9,
          fontFamily: "monospace",
        },
        labelBgStyle: { fill: "var(--navy)", fillOpacity: 0.9 },
        data: e.data,
      }));

      setRawNodes(mappedNodes);
      setRawEdges(mappedEdges);
      setNodeCount(data.nodes.length);
      setEdgeCount(data.edges.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply type filter whenever rawNodes/activeTypes change
  useEffect(() => {
    if (activeTypes.size === 0) {
      setNodes(rawNodes);
      setEdges(rawEdges);
      return;
    }
    const visibleIds = new Set(
      rawNodes
        .filter((n) => {
          const type = (n.data as NodeData).type;
          return activeTypes.has(type) || type === "value";
        })
        .map((n) => n.id)
    );
    setNodes(rawNodes.filter((n) => visibleIds.has(n.id)));
    setEdges(rawEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)));
  }, [rawNodes, rawEdges, activeTypes, setNodes, setEdges]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="font-mono text-[11px] opacity-30 animate-pulse">loading graph...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <span className="font-mono text-[11px] opacity-40">{error}</span>
        <button onClick={load} className="font-mono text-[10px]" style={{ color: "var(--amber)" }}>
          retry →
        </button>
      </div>
    );
  }

  if (rawNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <span className="font-mono text-[13px] opacity-20">no entities yet</span>
        <span className="font-mono text-[10px] opacity-15">start chatting to build the knowledge graph</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Stats bar */}
      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-3 px-3 py-1.5 rounded-sm font-mono text-[10px]"
        style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
      >
        <span style={{ color: "var(--amber)" }}>{nodeCount} nodes</span>
        <span className="opacity-20">·</span>
        <span className="opacity-40">{edgeCount} edges</span>
        <button onClick={load} className="opacity-30 hover:opacity-60 transition-opacity ml-1">↺</button>
      </div>

      {/* Type filter */}
      <TypeFilterBar activeTypes={activeTypes} onChange={setActiveTypes} />

      {/* Graph */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={2.5}
        style={{ background: "var(--navy)" }}
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => setSelectedId((prev) => (prev === node.id ? null : node.id))}
        onPaneClick={() => setSelectedId(null)}
      >
        <Background color="#ffffff06" gap={24} size={1} />
        <Controls
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            borderRadius: "3px",
          }}
        />
        <MiniMap
          style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
          nodeColor={(n) => {
            const type = (n.data as NodeData)?.type ?? "other";
            return TYPE_COLORS[type]?.border ?? "#475569";
          }}
          maskColor="rgba(7,8,15,0.7)"
        />
      </ReactFlow>

      <Legend />

      {/* Detail panel */}
      {selectedId && (
        <NodeDetailPanel
          nodeId={selectedId}
          allNodes={rawNodes}
          allEdges={rawEdges}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
