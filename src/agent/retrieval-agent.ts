import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "@/agent/ollama";
import { db } from "@/db";
import { entities, relationships } from "@/db/schema";
import { ilike, eq, and, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { OLLAMA_BASE_URL, EMBEDDING_MODEL } from "@/shared/constants";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SemanticChunk {
  text: string;
  similarity: number;
  createdAt: Date;
}

export interface GraphEntity {
  name: string;
  type: string;
  facts: string[];
  decayScore: number;
}

export interface RetrievalContext {
  semanticChunks: SemanticChunk[];
  graphEntities: GraphEntity[];
  dedupedFacts: string[];
}

// ── Query classification schema ────────────────────────────────────────────────

const QueryClassificationSchema = z.object({
  needsSemantic: z.boolean().describe(
    "true if the message asks about past conversations, past events, or needs context from memory"
  ),
  needsGraph: z.boolean().describe(
    "true if the message references people, projects, organizations, or specific named things"
  ),
  entities: z.array(z.string()).describe(
    "named entities explicitly mentioned: people, projects, technologies, organizations"
  ),
  isTimeReference: z.boolean().describe(
    "true if the message references time ('last week', 'yesterday', 'before', 'when did')"
  ),
  urgency: z.enum(["immediate", "recall", "none"]).describe(
    "immediate = action needed now; recall = looking up past info; none = general question"
  ),
});

// ── Embedding helper (mirrors semantic.ts) ─────────────────────────────────────

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding ?? null;
  } catch {
    return null;
  }
}

// ── Recency-weighted pgvector search ──────────────────────────────────────────
// Score = cosine_similarity * exp(-λ * age_in_days)
// λ = 0.005 means a 140-day-old chunk scores ~50% of a fresh chunk at equal similarity.

async function searchSimilarWeighted(
  query: string,
  limit: number
): Promise<SemanticChunk[]> {
  const embedding = await getEmbedding(query);
  if (!embedding) return [];

  const vectorStr = `[${embedding.join(",")}]`;

  const rows = await db.execute<{
    content_text: string;
    weighted_score: number;
    created_at: string;
  }>(
    sql`
      SELECT
        content_text,
        (1 - (embedding <=> ${vectorStr}::vector))
          * exp(-0.005 * EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0)
          AS weighted_score,
        created_at
      FROM embeddings
      WHERE embedding IS NOT NULL
      ORDER BY weighted_score DESC
      LIMIT ${limit}
    `
  );

  return rows.rows.map((r) => ({
    text: r.content_text,
    similarity: Number(r.weighted_score),
    createdAt: new Date(r.created_at),
  }));
}

// ── Graph entity lookup ────────────────────────────────────────────────────────

async function lookupEntities(names: string[]): Promise<GraphEntity[]> {
  if (names.length === 0) return [];

  // Case-insensitive match for each entity name
  const found: GraphEntity[] = [];

  for (const name of names.slice(0, 8)) {
    const rows = await db
      .select()
      .from(entities)
      .where(ilike(entities.name, name))
      .limit(1);

    if (rows.length === 0) continue;
    const entity = rows[0];

    // Load active relationships for this entity
    const rels = await db
      .select()
      .from(relationships)
      .where(
        and(
          eq(relationships.subjectId, entity.id),
          eq(relationships.isActive, true)
        )
      )
      .limit(10);

    const facts = rels.map((r) =>
      r.objectValue
        ? `${r.predicate}: ${r.objectValue}`
        : r.predicate
    );

    found.push({
      name: entity.name,
      type: entity.type,
      facts,
      decayScore: entity.decayScore,
    });
  }

  return found;
}

// ── Main retrieval agent ───────────────────────────────────────────────────────
// Runs synchronously BEFORE the orchestrator builds its system prompt.
// Classifies the query, then fetches only the data that's actually needed.

export async function runRetrievalAgent(
  userMessage: string,
  recentHistoryEntityNames: string[]
): Promise<RetrievalContext> {
  const empty: RetrievalContext = {
    semanticChunks: [],
    graphEntities: [],
    dedupedFacts: [],
  };

  // Step 1: Classify the query
  let classification: z.infer<typeof QueryClassificationSchema>;
  try {
    const result = await generateObject({
      model: extractionModel,
      schema: QueryClassificationSchema,
      temperature: 0,
      prompt: `Classify this user message for memory retrieval:

"${userMessage}"

Determine what context from long-term memory (if any) would help answer this.`,
    });
    classification = result.object;
  } catch {
    // Classification failure → safe fallback: no extra retrieval
    return empty;
  }

  // Skip all DB work for immediate-action or no-recall queries under 6 words
  if (
    classification.urgency === "none" &&
    !classification.needsSemantic &&
    !classification.needsGraph &&
    classification.entities.length === 0
  ) {
    return empty;
  }

  // Build set of names already visible in recent history (for dedup)
  const historySet = new Set(
    recentHistoryEntityNames.map((n) => n.toLowerCase())
  );

  const ctx: RetrievalContext = {
    semanticChunks: [],
    graphEntities: [],
    dedupedFacts: [],
  };

  // Step 2: pgvector semantic search (only when needed)
  if (classification.needsSemantic || classification.isTimeReference) {
    try {
      ctx.semanticChunks = await searchSimilarWeighted(userMessage, 5);
    } catch {
      // Non-fatal
    }
  }

  // Step 3: Graph entity lookup (named entities OR explicit needsGraph)
  const toQuery = classification.entities.length > 0 ? classification.entities : [];
  if (classification.needsGraph && toQuery.length === 0) {
    // needsGraph but no explicit entities → skip (LLM can use tools later)
  }

  if (toQuery.length > 0) {
    try {
      const found = await lookupEntities(toQuery);
      // Dedup: skip entities whose names appear verbatim in recent history
      ctx.graphEntities = found.filter(
        (e) => !historySet.has(e.name.toLowerCase())
      );
    } catch {
      // Non-fatal
    }
  }

  // Step 4: Flatten graph facts into deduped string list
  ctx.dedupedFacts = [
    ...new Set(
      ctx.graphEntities.flatMap((e) =>
        e.facts.map((f) => `${e.name} — ${f}`)
      )
    ),
  ];

  return ctx;
}
