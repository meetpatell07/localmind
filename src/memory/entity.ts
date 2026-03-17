import { generateText } from "ai";
import { db } from "@/db";
import { entities, relationships, embeddings, atomicFacts } from "@/db/schema";
import { eq, and, ilike, sql, inArray, gte } from "drizzle-orm";
import type { ExtractionResult } from "@/agent/extract";
import type { EntityWithRelationships } from "@/shared/types";
import { OLLAMA_BASE_URL, EMBEDDING_MODEL } from "@/shared/constants";
import { hot, HOT_KEY } from "./hot";
import { reinforceEntity, DECAY_ARCHIVE_THRESHOLD } from "./decay";
import { extractionModel } from "@/agent/ollama";

// ── Embedding helper ──────────────────────────────────────────────────────────
// Inlined here so entity.ts has no circular dependency on semantic.ts.
async function embedText(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { embedding?: number[] };
    return data.embedding ?? null;
  } catch {
    return null;
  }
}

// Similarity threshold above which two entity names are considered the same node.
const DEDUP_SIMILARITY_THRESHOLD = 0.88;

// ── Vector-based entity deduplication ────────────────────────────────────────
/**
 * Find an existing entity that is semantically equivalent to `name`.
 *
 * Strategy (two-pass):
 * 1. Fast path — exact or case-insensitive string match via Drizzle ilike.
 * 2. Slow path — embed the name, cosine-search the entity-name embeddings via
 *    pgvector, and accept the top result if similarity ≥ threshold.
 *
 * Returns the existing entity row, or null if no match found.
 */
async function findSimilarEntity(
  name: string,
  type: string
): Promise<{ id: string; name: string; aliases: string[] | null } | null> {
  // ── Pass 1: exact / case-insensitive match ──────────────────────────────
  const exactRows = await db
    .select({ id: entities.id, name: entities.name, aliases: entities.aliases })
    .from(entities)
    .where(ilike(entities.name, name.trim()))
    .limit(1);

  if (exactRows[0]) return exactRows[0];

  // ── Pass 2: check known aliases ─────────────────────────────────────────
  // The aliases column is a jsonb string[]. We cast and unnest to search.
  const aliasRows = await db.execute<{ id: string; name: string; aliases: string[] }>(
    sql`
      SELECT id, name, aliases
      FROM entities
      WHERE aliases @> ${JSON.stringify([name])}::jsonb
      LIMIT 1
    `
  );
  if (aliasRows.rows[0]) return aliasRows.rows[0];

  // ── Pass 3: vector similarity on entity-name embeddings ─────────────────
  const vec = await embedText(name);
  if (!vec) return null;

  const vectorStr = `[${vec.join(",")}]`;

  // Search the embeddings table where we stored entity-name vectors
  // (sourceType = 'entity-name', sourceId = entity.id)
  const simRows = await db.execute<{
    source_id: string;
    similarity: number;
  }>(
    sql`
      SELECT source_id,
             1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM   embeddings
      WHERE  source_type = 'entity-name'
        AND  embedding IS NOT NULL
      ORDER  BY embedding <=> ${vectorStr}::vector
      LIMIT  3
    `
  );

  const best = simRows.rows[0];
  if (!best || best.similarity < DEDUP_SIMILARITY_THRESHOLD) return null;

  // Load the matched entity row
  const matched = await db
    .select({ id: entities.id, name: entities.name, aliases: entities.aliases })
    .from(entities)
    .where(eq(entities.id, best.source_id))
    .limit(1);

  if (!matched[0]) return null;

  // Only accept the match if the types are compatible (or one is "other")
  const matchedTypeRows = await db
    .select({ type: entities.type })
    .from(entities)
    .where(eq(entities.id, matched[0].id))
    .limit(1);

  const matchedType = matchedTypeRows[0]?.type ?? "other";
  if (matchedType !== type && matchedType !== "other" && type !== "other") {
    // Different concrete types — treat as distinct entities
    return null;
  }

  return matched[0];
}

// ── Store entity-name embedding ───────────────────────────────────────────────
async function storeEntityNameEmbedding(
  entityId: string,
  name: string
): Promise<void> {
  const vec = await embedText(name);
  if (!vec) return;

  const vectorStr = `[${vec.join(",")}]`;

  const [row] = await db
    .insert(embeddings)
    .values({
      contentText: name,
      sourceType: "entity-name",
      sourceId: entityId,
      metadata: { entityId },
    })
    .returning({ id: embeddings.id });

  if (!row) return;

  await db.execute(
    sql`UPDATE embeddings SET embedding = ${vectorStr}::vector WHERE id = ${row.id}`
  );
}

// ── Entity summary builder (Graphiti-style evolving summary) ─────────────────
/**
 * Rebuild the ~100-token summary for an entity by asking the LLM to describe it
 * based on its name, type, attributes, and active relationships.
 * Runs async — never blocks the pipeline.
 */
async function rebuildEntitySummary(entityId: string): Promise<void> {
  try {
    const [entityRow] = await db
      .select({ name: entities.name, type: entities.type, attributes: entities.attributes })
      .from(entities)
      .where(eq(entities.id, entityId))
      .limit(1);

    if (!entityRow) return;

    const relRows = await db
      .select({ predicate: relationships.predicate, objectValue: relationships.objectValue })
      .from(relationships)
      .where(and(eq(relationships.subjectId, entityId), eq(relationships.isActive, true)))
      .limit(20);

    const attrText = Object.entries((entityRow.attributes as Record<string, string>) ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const relText = relRows
      .map((r) => `${r.predicate.replace(/_/g, " ")}: ${r.objectValue ?? "?"}`)
      .join("; ");

    const prompt = [
      `Entity: "${entityRow.name}" (${entityRow.type})`,
      attrText  ? `Attributes: ${attrText}` : "",
      relText   ? `Known facts: ${relText}` : "",
      `Write a single concise sentence (max 80 words) describing what is known about this entity. Be factual and specific. No filler.`,
    ].filter(Boolean).join("\n");

    const { text } = await generateText({
      model: extractionModel,
      prompt,
      temperature: 0.0,
      abortSignal: AbortSignal.timeout(20_000),
    });

    const summary = text.trim().slice(0, 500);
    if (summary.length > 10) {
      await db.update(entities).set({ summary }).where(eq(entities.id, entityId));
      hot.delete(HOT_KEY.graphNodes()); // invalidate graph cache
    }
  } catch {
    // Non-fatal — summary rebuilds silently fail
  }
}

// ── Core upsert ───────────────────────────────────────────────────────────────
/**
 * Find-or-create an entity with full vector dedup.
 * Returns the canonical entity id.
 *
 * On match:  increments mentionCount, merges attributes, adds new name as alias
 *            if it differs from the canonical name.
 * On create: inserts the row and stores a name embedding for future dedup.
 */
async function upsertEntity(
  name: string,
  type: string,
  attributes: Record<string, string> = {}
): Promise<string> {
  const trimmedName = name.trim();

  const existing = await findSimilarEntity(trimmedName, type);

  if (existing) {
    // ── Merge into existing node + reinforce decay ────────────────────────
    const currentAliases: string[] = existing.aliases ?? [];
    const newAliases =
      trimmedName.toLowerCase() !== existing.name.toLowerCase() &&
      !currentAliases.map((a) => a.toLowerCase()).includes(trimmedName.toLowerCase())
        ? [...currentAliases, trimmedName]
        : currentAliases;

    // Load current attributes to merge (non-destructive)
    const attrRows = await db
      .select({ attributes: entities.attributes, mentionCount: entities.mentionCount, type: entities.type })
      .from(entities)
      .where(eq(entities.id, existing.id))
      .limit(1);

    const currentAttrs = (attrRows[0]?.attributes as Record<string, string>) ?? {};
    const mergedAttrs = { ...currentAttrs, ...attributes };

    await db
      .update(entities)
      .set({
        mentionCount: (attrRows[0]?.mentionCount ?? 1) + 1,
        lastSeen: new Date(),
        aliases: newAliases,
        attributes: mergedAttrs,
      })
      .where(eq(entities.id, existing.id));

    // Reinforce decay score — entity is being mentioned again
    reinforceEntity(existing.id, attrRows[0]?.type ?? type).catch(() => {});

    // If this alias is new, also store its embedding for future lookups
    if (newAliases.length > (existing.aliases?.length ?? 0)) {
      storeEntityNameEmbedding(existing.id, trimmedName).catch(() => {});
    }

    // Rebuild summary every 5th mention (Graphiti-style evolving description)
    const newMentionCount = (attrRows[0]?.mentionCount ?? 1) + 1;
    if (newMentionCount % 5 === 0) {
      rebuildEntitySummary(existing.id).catch(() => {});
    }

    return existing.id;
  }

  // ── Create new node ───────────────────────────────────────────────────────
  const [created] = await db
    .insert(entities)
    .values({
      name: trimmedName,
      type,
      attributes,
      aliases: [],
      mentionCount: 1,
    })
    .returning({ id: entities.id });

  const newId = created!.id;

  // Store name embedding async — don't block the pipeline
  storeEntityNameEmbedding(newId, trimmedName).catch(() => {});

  return newId;
}

// ── Relationship upsert ───────────────────────────────────────────────────────
/**
 * Insert a relationship edge. Deactivates a conflicting prior edge only when
 * the new fact explicitly contradicts it (same subject + predicate, different
 * object). Additive relationships (e.g. multiple uses_technology) are stacked.
 *
 * Predicates considered "singular" (at most one active value per subject):
 *   has_role, works_at, lives_in, is_named, born_in, age
 */
const SINGULAR_PREDICATES = new Set([
  "has_role",
  "works_at",
  "lives_in",
  "is_named",
  "born_in",
  "age",
  "prefers_language",
  "primary_language",
]);

async function upsertRelationship(
  subjectId: string,
  predicate: string,
  objectEntityId: string | null,
  objectValue: string | null,
  confidence: number,
  sourceConversationId?: string | null
): Promise<string | null> {
  const normalizedPredicate = predicate.toLowerCase().replace(/\s+/g, "_");

  // ── Dedup: skip if this exact edge already exists and is active ───────────
  const existingEdge = await db
    .select({ id: relationships.id, factVersion: relationships.factVersion })
    .from(relationships)
    .where(
      and(
        eq(relationships.subjectId, subjectId),
        eq(relationships.predicate, normalizedPredicate),
        eq(relationships.isActive, true),
        objectEntityId
          ? eq(relationships.objectEntityId, objectEntityId)
          : sql`object_value ILIKE ${objectValue ?? ""}`
      )
    )
    .limit(1);

  if (existingEdge[0]) {
    // Already recorded — just bump confidence if higher
    await db
      .update(relationships)
      .set({ confidence: Math.max(confidence, 0.8) })
      .where(eq(relationships.id, existingEdge[0].id));
    return existingEdge[0].id;
  }

  // ── Find conflicting singular edges to supersede ──────────────────────────
  let supersededVersion = 0;
  let supersededId: string | null = null;

  if (SINGULAR_PREDICATES.has(normalizedPredicate)) {
    const conflicting = await db
      .select({ id: relationships.id, factVersion: relationships.factVersion })
      .from(relationships)
      .where(
        and(
          eq(relationships.subjectId, subjectId),
          eq(relationships.predicate, normalizedPredicate),
          eq(relationships.isActive, true)
        )
      )
      .limit(1);

    if (conflicting[0]) {
      supersededId = conflicting[0].id;
      supersededVersion = conflicting[0].factVersion ?? 1;
    }
  }

  // ── Insert new edge (gets the next version number) ────────────────────────
  const [newEdge] = await db
    .insert(relationships)
    .values({
      subjectId,
      predicate: normalizedPredicate,
      objectEntityId: objectEntityId ?? null,
      objectValue: objectEntityId ? null : objectValue,
      confidence,
      isActive: true,
      factVersion: supersededVersion + 1,
      validFrom: new Date(),
      sourceConversationId: sourceConversationId ?? null,
    })
    .returning({ id: relationships.id });

  const newId = newEdge?.id ?? null;

  // ── Deactivate the superseded edge, point it to the new one ──────────────
  if (supersededId && newId) {
    await db
      .update(relationships)
      .set({
        isActive: false,
        validUntil: new Date(),
        supersededById: newId,
      })
      .where(eq(relationships.id, supersededId));
  }

  // Invalidate graph cache after any topology change
  hot.delete(HOT_KEY.graphNodes());

  return newId;
}

// ── Atomic fact persistence ───────────────────────────────────────────────────
/**
 * Store a granular atomic fact derived from a relationship edge.
 * Supersedes prior active facts with the same entity+predicate when singular.
 */
async function storeAtomicFact(
  entityId: string,
  predicate: string,
  rawFact: string,
  objectValue: string | null,
  confidence: number,
  sourceConversationId?: string | null
): Promise<void> {
  const normalizedPredicate = predicate.toLowerCase().replace(/\s+/g, "_");

  // Dedup — skip if identical active fact already exists
  const existing = await db
    .select({ id: atomicFacts.id, factVersion: atomicFacts.factVersion })
    .from(atomicFacts)
    .where(
      and(
        eq(atomicFacts.entityId, entityId),
        eq(atomicFacts.predicate, normalizedPredicate),
        eq(atomicFacts.isActive, true),
        sql`raw_fact ILIKE ${rawFact}`
      )
    )
    .limit(1);

  if (existing[0]) return; // Already stored

  // Find superseded facts for singular predicates
  let supersededVersion = 0;
  let supersededFactId: string | null = null;

  if (SINGULAR_PREDICATES.has(normalizedPredicate)) {
    const old = await db
      .select({ id: atomicFacts.id, factVersion: atomicFacts.factVersion })
      .from(atomicFacts)
      .where(
        and(
          eq(atomicFacts.entityId, entityId),
          eq(atomicFacts.predicate, normalizedPredicate),
          eq(atomicFacts.isActive, true)
        )
      )
      .limit(1);

    if (old[0]) {
      supersededFactId = old[0].id;
      supersededVersion = old[0].factVersion ?? 1;
    }
  }

  const [newFact] = await db
    .insert(atomicFacts)
    .values({
      entityId,
      rawFact,
      predicate: normalizedPredicate,
      objectValue,
      confidence,
      isActive: true,
      factVersion: supersededVersion + 1,
      validFrom: new Date(),
      sourceConversationId: sourceConversationId ?? null,
    })
    .returning({ id: atomicFacts.id });

  if (supersededFactId && newFact?.id) {
    await db
      .update(atomicFacts)
      .set({
        isActive: false,
        validUntil: new Date(),
        supersededById: newFact.id,
      })
      .where(eq(atomicFacts.id, supersededFactId));
  }
}

// ── Public: process full extraction result ────────────────────────────────────
/**
 * Persist all entities and relationships from an extraction result.
 * Idempotent — safe to call multiple times with the same data.
 * All operations are parameterized via Drizzle / sql template tag.
 */
export async function processExtractedEntities(
  extracted: ExtractionResult
): Promise<void> {
  if (extracted.entities.length === 0 && extracted.relationships.length === 0) {
    return;
  }

  // ── Phase 1: upsert all entities, build name → id map ────────────────────
  const entityIdMap = new Map<string, string>();

  for (const entity of extracted.entities) {
    const id = await upsertEntity(entity.name, entity.type, entity.attributes);
    entityIdMap.set(entity.name.toLowerCase(), id);
  }

  // ── Phase 2: upsert all relationship edges + derive atomic facts ──────────
  for (const rel of extracted.relationships) {
    const subjectId = entityIdMap.get(rel.subject.toLowerCase());
    if (!subjectId) continue; // subject wasn't extracted — skip

    // Resolve object: might be a known entity or a raw value
    const objectEntityId = entityIdMap.get(rel.object.toLowerCase()) ?? null;
    const objectValue = objectEntityId ? null : rel.object;

    await upsertRelationship(
      subjectId,
      rel.predicate,
      objectEntityId,
      objectValue,
      rel.confidence
    );

    // Derive an atomic fact sentence from this edge (async, fire-and-forget)
    const rawFact = `${rel.subject} ${rel.predicate.replace(/_/g, " ")} ${rel.object}`;
    storeAtomicFact(
      subjectId,
      rel.predicate,
      rawFact,
      objectValue ?? rel.object,
      rel.confidence
    ).catch(() => {});
  }
}

// ── Public: context lookup for prompt injection ───────────────────────────────
/**
 * Return entity nodes (with their active edges) for a list of candidate names.
 * Used by recall() to inject L3 context into the system prompt.
 */
export async function getEntityContext(
  names: string[]
): Promise<EntityWithRelationships[]> {
  if (names.length === 0) return [];

  // Single batched query: ilike OR across all candidate names, skip archived
  const entityRows = await db
    .select({ id: entities.id, name: entities.name, type: entities.type })
    .from(entities)
    .where(
      and(
        sql`${entities.name} ILIKE ANY(ARRAY[${sql.join(
          names.map((n) => sql`${"%" + n + "%"}`),
          sql`, `
        )}])`,
        gte(entities.decayScore, DECAY_ARCHIVE_THRESHOLD)
      )
    )
    .limit(10);

  if (entityRows.length === 0) return [];

  const ids = entityRows.map((e) => e.id);

  // Batch-fetch all active relationships for these entities
  const relRows = await db
    .select({
      subjectId: relationships.subjectId,
      predicate: relationships.predicate,
      objectValue: relationships.objectValue,
      confidence: relationships.confidence,
    })
    .from(relationships)
    .where(
      and(
        inArray(relationships.subjectId, ids),
        eq(relationships.isActive, true)
      )
    )
    .limit(50);

  // Group relationships by subjectId
  const relsBySubject = new Map<string, typeof relRows>();
  for (const rel of relRows) {
    const list = relsBySubject.get(rel.subjectId) ?? [];
    list.push(rel);
    relsBySubject.set(rel.subjectId, list);
  }

  return entityRows.map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    relationships: (relsBySubject.get(entity.id) ?? []).map((r) => ({
      predicate: r.predicate,
      objectValue: r.objectValue,
      confidence: r.confidence ?? 0.8,
    })),
  }));
}
