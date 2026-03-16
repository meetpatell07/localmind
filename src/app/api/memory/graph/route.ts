import { NextResponse } from "next/server";
import { db } from "@/db";
import { entities, relationships } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { hot, HOT_TTL, HOT_KEY } from "@/memory/hot";

export interface GraphNode {
  id: string;
  data: {
    label: string;
    type: string;
    mentionCount: number;
    decayScore: number;
  };
  position: { x: number; y: number };
  type: "entityNode";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated: boolean;
  data: { confidence: number; factVersion: number };
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Force-directed layout approximation (circle + jitter) ────────────────────
function layoutNodes(nodes: GraphNode[]): GraphNode[] {
  const count = nodes.length;
  const radius = Math.max(200, count * 40);

  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / count;
    // Small deterministic jitter so overlapping nodes spread apart
    const jitter = ((i * 137.508) % 80) - 40;
    return {
      ...node,
      position: {
        x: Math.round(radius * Math.cos(angle) + 600 + jitter),
        y: Math.round(radius * Math.sin(angle) + 400 + jitter),
      },
    };
  });
}

export async function GET() {
  // ── Hot cache ───────────────────────────────────────────────────────────────
  const cached = hot.get<GraphPayload>(HOT_KEY.graphNodes());
  if (cached) return NextResponse.json(cached);

  try {
    // Fetch top 60 entities by mention count
    const entityRows = await db
      .select({
        id: entities.id,
        name: entities.name,
        type: entities.type,
        mentionCount: entities.mentionCount,
        decayScore: entities.decayScore,
      })
      .from(entities)
      .orderBy(desc(entities.decayScore), desc(entities.mentionCount))
      .limit(60);

    if (entityRows.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const entityIds = entityRows.map((e) => e.id);
    const entityIdSet = new Set(entityIds);

    // Fetch active relationships between these entities
    const relRows = await db
      .select({
        id: relationships.id,
        subjectId: relationships.subjectId,
        predicate: relationships.predicate,
        objectEntityId: relationships.objectEntityId,
        objectValue: relationships.objectValue,
        confidence: relationships.confidence,
        factVersion: relationships.factVersion,
      })
      .from(relationships)
      .where(eq(relationships.isActive, true))
      .limit(200);

    // Build nodes
    const rawNodes: GraphNode[] = entityRows.map((e) => ({
      id: e.id,
      type: "entityNode",
      data: {
        label: e.name,
        type: e.type,
        mentionCount: e.mentionCount ?? 1,
        decayScore: e.decayScore ?? 1.0,
      },
      position: { x: 0, y: 0 }, // will be set by layout
    }));

    const nodes = layoutNodes(rawNodes);

    // Build edges — only between entities in our fetched set
    const edges: GraphEdge[] = [];
    for (const rel of relRows) {
      if (!entityIdSet.has(rel.subjectId)) continue;

      if (rel.objectEntityId && entityIdSet.has(rel.objectEntityId)) {
        // Entity → Entity edge
        edges.push({
          id: rel.id,
          source: rel.subjectId,
          target: rel.objectEntityId,
          label: rel.predicate.replace(/_/g, " "),
          animated: false,
          data: {
            confidence: rel.confidence ?? 0.8,
            factVersion: rel.factVersion ?? 1,
          },
        });
      }
      // Value-only edges (objectEntityId = null) are omitted from graph view
      // to avoid cluttering with leaf nodes
    }

    const payload: GraphPayload = { nodes, edges };

    hot.set(HOT_KEY.graphNodes(), payload, HOT_TTL.GRAPH);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[graph API]", err);
    return NextResponse.json({ nodes: [], edges: [] }, { status: 500 });
  }
}
