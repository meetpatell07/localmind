/**
 * Intelligent Decay — lets less relevant information fade while keeping
 * important facts sharp.
 *
 * Model: exponential half-life decay per entity type.
 *
 *   score(t) = confidence × 0.5^(daysSince / halfLife)
 *
 * Half-life by type (in days):
 *   event        →  7   Short-lived: meetings, deadlines, incidents
 *   preference   → 30   Habits can shift but are semi-stable
 *   technology   → 60   Skills stay relevant for months
 *   project      → 90   Long-running work
 *   organization → 90
 *   person       → 120  Relationships are durable
 *   concept      → 180  Abstract knowledge is very stable
 *   other        →  45
 *
 * Reinforcement: every time an entity is re-mentioned in conversation its
 * decayScore is refreshed toward max(currentScore + 0.3, confidence × 0.95).
 * This means frequently-discussed facts stay near 1.0 indefinitely.
 *
 * Archival threshold: entities below 0.05 are omitted from prompt injection
 * (profile + entity context). They remain in the DB for full recall if queried
 * directly, but no longer clutter the active context window.
 */

import { db } from "@/db";
import { entities, relationships, atomicFacts } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { hot, HOT_KEY } from "./hot";

// ── Half-life table ───────────────────────────────────────────────────────────
const HALF_LIFE_DAYS: Record<string, number> = {
  event:        7,
  preference:   30,
  technology:   60,
  project:      90,
  organization: 90,
  person:       120,
  concept:      180,
  other:        45,
};

const DEFAULT_HALF_LIFE = 45;

/** Archival threshold — below this the entity is excluded from active context. */
export const DECAY_ARCHIVE_THRESHOLD = 0.05;

/** Minimum decay score — never goes to absolute zero (always retrievable). */
const DECAY_FLOOR = 0.01;

// ── Core decay formula ────────────────────────────────────────────────────────
export function computeDecayScore(
  lastSeen: Date,
  entityType: string,
  confidence = 1.0,
  now = new Date()
): number {
  const halfLife = HALF_LIFE_DAYS[entityType] ?? DEFAULT_HALF_LIFE;
  const daysSince = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
  const raw = confidence * Math.pow(0.5, daysSince / halfLife);
  return Math.max(DECAY_FLOOR, Math.min(1.0, raw));
}

// ── Reinforcement — called when an entity is re-mentioned ────────────────────
/**
 * Refresh an entity's decay score toward 1.0 after a new mention.
 * Also bumps its relationships' decay scores proportionally.
 */
export async function reinforceEntity(
  entityId: string,
  entityType: string,
  confidence = 0.9
): Promise<void> {
  // Load current score
  const rows = await db
    .select({ decayScore: entities.decayScore, mentionCount: entities.mentionCount })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);

  if (!rows[0]) return;

  const current = rows[0].decayScore ?? 1.0;
  // Refresh: push score up but weight toward the long-term average
  const refreshed = Math.min(1.0, Math.max(current + 0.3, confidence * 0.95));

  await db
    .update(entities)
    .set({
      decayScore: refreshed,
      lastSeen: new Date(),
      mentionCount: (rows[0].mentionCount ?? 1) + 1,
    })
    .where(eq(entities.id, entityId));

  // Cascade refresh to active relationships where this is the subject
  await db
    .update(relationships)
    .set({ decayScore: Math.min(1.0, refreshed * 0.9) })
    .where(
      and(
        eq(relationships.subjectId, entityId),
        eq(relationships.isActive, true)
      )
    );

  // Invalidate graph cache
  hot.delete(HOT_KEY.graphNodes());
}

// ── Batch decay cycle ─────────────────────────────────────────────────────────
/**
 * Recompute decay scores for all active entities and their facts.
 * Called every N interactions (cheap — pure math, no LLM calls).
 * Runs as a background fire-and-forget from memory/index.ts.
 */
export async function runDecayCycle(): Promise<void> {
  const now = new Date();

  // ── 1. Entities ───────────────────────────────────────────────────────────
  const allEntities = await db
    .select({
      id: entities.id,
      type: entities.type,
      lastSeen: entities.lastSeen,
      decayScore: entities.decayScore,
    })
    .from(entities)
    .limit(500); // Process up to 500 per cycle

  for (const entity of allEntities) {
    const newScore = computeDecayScore(entity.lastSeen, entity.type, 1.0, now);
    if (Math.abs(newScore - (entity.decayScore ?? 1.0)) > 0.01) {
      await db
        .update(entities)
        .set({ decayScore: newScore })
        .where(eq(entities.id, entity.id));
    }
  }

  // ── 2. Active relationships ───────────────────────────────────────────────
  // Relationship decay is tied to its subject entity's type/lastSeen.
  // We join via subjectId to inherit the type's half-life.
  const activeRels = await db
    .select({
      id: relationships.id,
      subjectId: relationships.subjectId,
      validFrom: relationships.validFrom,
      confidence: relationships.confidence,
      decayScore: relationships.decayScore,
    })
    .from(relationships)
    .where(
      and(
        eq(relationships.isActive, true),
        isNull(relationships.validUntil)
      )
    )
    .limit(1000);

  // Build entity type map from entities we already fetched
  const entityTypeMap = new Map(allEntities.map((e) => [e.id, e.type]));

  for (const rel of activeRels) {
    const entityType = entityTypeMap.get(rel.subjectId) ?? "other";
    const newScore = computeDecayScore(
      rel.validFrom,
      entityType,
      rel.confidence ?? 0.8,
      now
    );
    if (Math.abs(newScore - (rel.decayScore ?? 1.0)) > 0.01) {
      await db
        .update(relationships)
        .set({ decayScore: newScore })
        .where(eq(relationships.id, rel.id));
    }
  }

  // ── 3. Atomic facts ───────────────────────────────────────────────────────
  const activeFacts = await db
    .select({
      id: atomicFacts.id,
      entityId: atomicFacts.entityId,
      validFrom: atomicFacts.validFrom,
      confidence: atomicFacts.confidence,
      decayScore: atomicFacts.decayScore,
    })
    .from(atomicFacts)
    .where(eq(atomicFacts.isActive, true))
    .limit(1000);

  for (const fact of activeFacts) {
    const entityType = entityTypeMap.get(fact.entityId) ?? "other";
    const newScore = computeDecayScore(
      fact.validFrom,
      entityType,
      fact.confidence ?? 0.8,
      now
    );
    if (Math.abs(newScore - (fact.decayScore ?? 1.0)) > 0.01) {
      await db
        .update(atomicFacts)
        .set({ decayScore: newScore })
        .where(eq(atomicFacts.id, fact.id));
    }
  }

  // Invalidate graph cache since decay scores changed
  hot.delete(HOT_KEY.graphNodes());
}

// ── Decay-aware entity count ──────────────────────────────────────────────────
/**
 * Count how many entities are "active" (above archival threshold).
 * Used for diagnostics / Memory tab stats.
 */
export async function getDecayStats(): Promise<{
  total: number;
  active: number;
  fading: number;   // 0.05–0.3
  archived: number; // < 0.05
}> {
  const rows = await db
    .select({ decayScore: entities.decayScore })
    .from(entities)
    .limit(1000);

  const total = rows.length;
  const archived = rows.filter((r) => (r.decayScore ?? 1) < DECAY_ARCHIVE_THRESHOLD).length;
  const fading   = rows.filter((r) => {
    const s = r.decayScore ?? 1;
    return s >= DECAY_ARCHIVE_THRESHOLD && s < 0.3;
  }).length;
  const active = total - fading - archived;

  return { total, active, fading, archived };
}
