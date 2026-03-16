import { db } from "@/db";
import { profile, entities, relationships } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateText } from "ai";
import { extractionModel } from "@/agent/ollama";
import { PROFILE_REBUILD_INTERVAL } from "@/shared/constants";

// In-memory cache
let cachedProfile: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

export async function getProfile(): Promise<string | null> {
  const now = Date.now();
  if (cachedProfile && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedProfile;
  }

  const rows = await db.select().from(profile).limit(1);
  if (!rows[0]) return null;

  cachedProfile = rows[0].summaryText;
  cacheTimestamp = now;
  return cachedProfile;
}

export async function maybeRebuildProfile(interactionCount: number): Promise<void> {
  if (interactionCount % PROFILE_REBUILD_INTERVAL !== 0) return;
  await rebuildProfile(interactionCount);
}

export async function rebuildProfile(interactionCount: number): Promise<void> {
  const topEntities = await db
    .select()
    .from(entities)
    .orderBy(desc(entities.mentionCount))
    .limit(30);

  if (topEntities.length === 0) return;

  const entitySummary = topEntities
    .map((e) => `- ${e.name} (${e.type})`)
    .join("\n");

  const activeRels = await db
    .select({
      subjectId: relationships.subjectId,
      predicate: relationships.predicate,
      objectValue: relationships.objectValue,
    })
    .from(relationships)
    .where(eq(relationships.isActive, true))
    .limit(50);

  const relSummary = activeRels
    .map((r) => `- ${r.predicate}: ${r.objectValue}`)
    .join("\n");

  const prompt = `Based on these entities and relationships extracted from conversations with Meet, write a concise ~400-token personal profile summary about Meet. Focus on: who they are, what they do, their projects, interests, and important context. Be factual and specific.

Entities (by frequency):
${entitySummary}

Active Relationships:
${relSummary}

Profile:`;

  try {
    const { text } = await generateText({ model: extractionModel, prompt });

    const existing = await db.select({ id: profile.id }).from(profile).limit(1);

    if (existing[0]) {
      await db
        .update(profile)
        .set({
          summaryText: text,
          interactionCountAtRebuild: interactionCount,
          lastRebuilt: new Date(),
        })
        .where(eq(profile.id, existing[0].id));
    } else {
      await db.insert(profile).values({
        summaryText: text,
        interactionCountAtRebuild: interactionCount,
      });
    }

    // Invalidate cache
    cachedProfile = null;
    cacheTimestamp = 0;
  } catch {
    // Non-fatal: profile rebuild failure doesn't break anything
  }
}
