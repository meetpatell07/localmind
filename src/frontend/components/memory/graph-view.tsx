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
  other:        { bg: "#111320", border: "#475569", text: "#94a3b8" },
};

// ── Custom entity node ─────────────────────────────────────────────────────────
function EntityNode({ data }: NodeProps) {
  const nodeData = data as { label: string; type: string; mentionCount: number; decayScore: number };
  const colors = TYPE_COLORS[nodeData.type] ?? TYPE_COLORS.other;
  const decay = nodeData.decayScore ?? 1.0;

  // Nodes with low decay score go translucent — visually "fading"
  // Sharp nodes (≥ 0.7) are fully opaque; fading nodes (0.05–0.3) are dim
  const opacity = Math.max(0.25, decay);

  // Fading indicator: show a small decay bar below the label
  const decayPct = Math.round(decay * 100);
  const isSharp = decay >= 0.7;
  const isFading = decay < 0.35;

  return (
    <div
      className="px-3 py-2 rounded-sm font-mono text-[11px] max-w-[140px] text-center"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        boxShadow: `0 0 8px ${colors.border}${isSharp ? "44" : "11"}`,
        opacity,
        transition: "opacity 0.3s",
      }}
    >
      <div className="font-semibold leading-tight truncate">{nodeData.label}</div>
      <div className="text-[9px] opacity-40 mt-0.5 uppercase tracking-widest">
        {nodeData.type} · {nodeData.mentionCount}×
      </div>
      {/* Decay bar */}
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

const NODE_TYPES = { entityNode: EntityNode };

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend() {
  const entries = Object.entries(TYPE_COLORS).filter(([k]) => k !== "other");
  return (
    <div
      className="absolute bottom-4 left-4 z-10 p-3 rounded-sm font-mono text-[10px] space-y-1"
      style={{ background: "var(--surface-raised)", border: "1px solid var(--line)" }}
    >
      {entries.map(([type, colors]) => (
        <div key={type} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: colors.border }}
          />
          <span style={{ color: colors.text }}>{type}</span>
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
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/graph");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as GraphPayload;

      setNodes(
        data.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }))
      );
      setEdges(
        data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          animated: e.animated,
          style: { stroke: "#475569", strokeWidth: 1 },
          labelStyle: { fill: "#64748b", fontSize: 9, fontFamily: "monospace" },
          labelBgStyle: { fill: "var(--navy)", fillOpacity: 0.8 },
          data: e.data,
        }))
      );
      setNodeCount(data.nodes.length);
      setEdgeCount(data.edges.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => { load(); }, [load]);

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
        <button
          onClick={load}
          className="font-mono text-[10px]"
          style={{ color: "var(--amber)" }}
        >
          retry →
        </button>
      </div>
    );
  }

  if (nodes.length === 0) {
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
        <button
          onClick={load}
          className="opacity-30 hover:opacity-60 transition-opacity ml-1"
        >
          ↺
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        style={{ background: "var(--navy)" }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#ffffff08" gap={24} size={1} />
        <Controls
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
            borderRadius: "3px",
          }}
        />
        <MiniMap
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--line)",
          }}
          nodeColor={(n) => {
            const type = (n.data as { type: string })?.type ?? "other";
            return TYPE_COLORS[type]?.border ?? "#475569";
          }}
          maskColor="rgba(7,8,15,0.7)"
        />
      </ReactFlow>

      <Legend />
    </div>
  );
}
