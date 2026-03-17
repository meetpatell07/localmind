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
    attributes: Record<string, string>;
    aliases: string[];
    summary: string | null;
    isValueNode: boolean;
  };
  position: { x: number; y: number };
  type: "entityNode" | "valueNode";
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

// ── Two-ring layout: entity nodes inner circle, value nodes outer ring ─────────
function layoutNodes(nodes: GraphNode[]): GraphNode[] {
  const entityNodes = nodes.filter((n) => !n.data.isValueNode);
  const valueNodes  = nodes.filter((n) =>  n.data.isValueNode);

  const eCount  = entityNodes.length;
  const eRadius = Math.max(200, eCount * 45);

  const laidEntities = entityNodes.map((node, i) => {
    const angle  = (2 * Math.PI * i) / Math.max(1, eCount);
    const jitter = ((i * 137.508) % 80) - 40;
    return {
      ...node,
      position: {
        x: Math.round(eRadius * Math.cos(angle) + 600 + jitter),
        y: Math.round(eRadius * Math.sin(angle) + 400 + jitter),
      },
    };
  });

  const vCount  = valueNodes.length;
  const vRadius = eRadius + 200;

  const laidValues = valueNodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, vCount);
    return {
      ...node,
      position: {
        x: Math.round(vRadius * Math.cos(angle) + 600),
        y: Math.round(vRadius * Math.sin(angle) + 400),
      },
    };
  });

  return [...laidEntities, ...laidValues];
}

export async function GET() {
  // ── Hot cache ────────────────────────────────────────────────────────────────
  const cached = hot.get<GraphPayload>(HOT_KEY.graphNodes());
  if (cached) return NextResponse.json(cached);

  try {
    // Top 60 entities by relevance
    const entityRows = await db
      .select({
        id:           entities.id,
        name:         entities.name,
        type:         entities.type,
        mentionCount: entities.mentionCount,
        decayScore:   entities.decayScore,
        attributes:   entities.attributes,
        aliases:      entities.aliases,
        summary:      entities.summary,
      })
      .from(entities)
      .orderBy(desc(entities.decayScore), desc(entities.mentionCount))
      .limit(60);

    if (entityRows.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const entityIds    = entityRows.map((e) => e.id);
    const entityIdSet  = new Set(entityIds);

    // All active relationships
    const relRows = await db
      .select({
        id:            relationships.id,
        subjectId:     relationships.subjectId,
        predicate:     relationships.predicate,
        objectEntityId: relationships.objectEntityId,
        objectValue:   relationships.objectValue,
        confidence:    relationships.confidence,
        factVersion:   relationships.factVersion,
      })
      .from(relationships)
      .where(eq(relationships.isActive, true))
      .limit(300);

    // ── Build entity nodes ────────────────────────────────────────────────────
    const rawEntityNodes: GraphNode[] = entityRows.map((e) => ({
      id:   e.id,
      type: "entityNode" as const,
      data: {
        label:        e.name,
        type:         e.type,
        mentionCount: e.mentionCount ?? 1,
        decayScore:   e.decayScore   ?? 1.0,
        attributes:   (e.attributes  as Record<string, string>) ?? {},
        aliases:      (e.aliases     as string[]) ?? [],
        summary:      e.summary ?? null,
        isValueNode:  false,
      },
      position: { x: 0, y: 0 },
    }));

    // ── Build edges + value leaf nodes ────────────────────────────────────────
    const edges: GraphEdge[]                   = [];
    const valueNodeMap = new Map<string, GraphNode>();

    for (const rel of relRows) {
      if (!entityIdSet.has(rel.subjectId)) continue;

      const label = rel.predicate.replace(/_/g, " ");

      if (rel.objectEntityId && entityIdSet.has(rel.objectEntityId)) {
        // ── Entity → Entity edge ──────────────────────────────────────────────
        edges.push({
          id:       rel.id,
          source:   rel.subjectId,
          target:   rel.objectEntityId,
          label,
          animated: (rel.confidence ?? 0.8) >= 0.95,
          data: {
            confidence:  rel.confidence  ?? 0.8,
            factVersion: rel.factVersion ?? 1,
          },
        });
      } else if (
        !rel.objectEntityId &&
        rel.objectValue &&
        rel.objectValue.length <= 60
      ) {
        // ── Entity → Value leaf node ──────────────────────────────────────────
        const safeKey = rel.objectValue
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .slice(0, 40);
        const nodeId = `val_${safeKey}`;

        if (!valueNodeMap.has(nodeId) && valueNodeMap.size < 60) {
          valueNodeMap.set(nodeId, {
            id:   nodeId,
            type: "valueNode" as const,
            data: {
              label:        rel.objectValue,
              type:         "value",
              mentionCount: 1,
              decayScore:   1.0,
              attributes:   {},
              aliases:      [],
              summary:      null,
              isValueNode:  true,
            },
            position: { x: 0, y: 0 },
          });
        }

        if (valueNodeMap.has(nodeId)) {
          edges.push({
            id:       rel.id,
            source:   rel.subjectId,
            target:   nodeId,
            label,
            animated: false,
            data: {
              confidence:  rel.confidence  ?? 0.8,
              factVersion: rel.factVersion ?? 1,
            },
          });
        }
      }
    }

    const allNodes = layoutNodes([...rawEntityNodes, ...valueNodeMap.values()]);
    const payload: GraphPayload = { nodes: allNodes, edges };

    hot.set(HOT_KEY.graphNodes(), payload, HOT_TTL.GRAPH);

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[graph API]", err);
    return NextResponse.json({ nodes: [], edges: [] }, { status: 500 });
  }
}
