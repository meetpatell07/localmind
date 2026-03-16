import { db } from "@/db";
import { profile, entities, relationships, conversations } from "@/db/schema";
import { eq, desc, and, inArray, gte } from "drizzle-orm";
import { generateText } from "ai";
import { extractionModel } from "@/agent/ollama";
import { PROFILE_REBUILD_INTERVAL } from "@/shared/constants";
import { hot, HOT_TTL, HOT_KEY } from "./hot";
import { DECAY_ARCHIVE_THRESHOLD } from "./decay";

export async function getProfile(): Promise<string | null> {
  const cached = hot.get<string>(HOT_KEY.profile());
  if (cached !== null) return cached;

  const rows = await db.select().from(profile).limit(1);
  if (!rows[0]) return null;

  hot.set(HOT_KEY.profile(), rows[0].summaryText, HOT_TTL.PROFILE);
  return rows[0].summaryText;
}

export async function maybeRebuildProfile(interactionCount: number): Promise<void> {
  if (interactionCount % PROFILE_REBUILD_INTERVAL !== 0) return;
  await rebuildProfile(interactionCount);
}

// ── Graph aggregation ─────────────────────────────────────────────────────────
interface GraphSnapshot {
  // Grouped entity lists by type
  people:        Array<{ name: string; aliases: string[]; mentions: number; facts: string[] }>;
  projects:      Array<{ name: string; mentions: number; facts: string[] }>;
  technologies:  Array<{ name: string; mentions: number }>;
  organizations: Array<{ name: string; mentions: number }>;
  preferences:   string[];       // objectValue strings from preference relationships
  recentTopics:  string[];       // last 10 distinct assistant message excerpts
  totalEntities: number;
  totalFacts:    number;
}

async function buildGraphSnapshot(): Promise<GraphSnapshot> {
  // ── 1. Fetch top entities by type ─────────────────────────────────────────
  // Only include entities above the archival threshold, sorted by decay score
  // so the sharpest/most-recently-reinforced facts surface first.
  const allEntities = await db
    .select({
      id: entities.id,
      name: entities.name,
      type: entities.type,
      aliases: entities.aliases,
      mentionCount: entities.mentionCount,
      decayScore: entities.decayScore,
    })
    .from(entities)
    .where(gte(entities.decayScore, DECAY_ARCHIVE_THRESHOLD))
    .orderBy(desc(entities.decayScore), desc(entities.mentionCount))
    .limit(80);

  if (allEntities.length === 0) {
    return {
      people: [], projects: [], technologies: [],
      organizations: [], preferences: [],
      recentTopics: [], totalEntities: 0, totalFacts: 0,
    };
  }

  const ids = allEntities.map((e) => e.id);

  // ── 2. Fetch all active relationships for these entities ──────────────────
  const relRows = await db
    .select({
      subjectId: relationships.subjectId,
      predicate: relationships.predicate,
      objectValue: relationships.objectValue,
    })
    .from(relationships)
    .where(
      and(
        inArray(relationships.subjectId, ids),
        eq(relationships.isActive, true)
      )
    )
    .limit(300);

  // Group by subjectId → list of "predicate: value" strings
  const factsByEntity = new Map<string, string[]>();
  for (const rel of relRows) {
    const list = factsByEntity.get(rel.subjectId) ?? [];
    if (rel.objectValue) list.push(`${rel.predicate}: ${rel.objectValue}`);
    factsByEntity.set(rel.subjectId, list);
  }

  // ── 3. Categorise ─────────────────────────────────────────────────────────
  const snapshot: GraphSnapshot = {
    people: [], projects: [], technologies: [],
    organizations: [], preferences: [],
    recentTopics: [],
    totalEntities: allEntities.length,
    totalFacts: relRows.length,
  };

  for (const entity of allEntities) {
    const facts = factsByEntity.get(entity.id) ?? [];

    switch (entity.type) {
      case "person":
        snapshot.people.push({
          name: entity.name,
          aliases: (entity.aliases as string[]) ?? [],
          mentions: entity.mentionCount ?? 1,
          facts: facts.slice(0, 8),
        });
        break;
      case "project":
        snapshot.projects.push({
          name: entity.name,
          mentions: entity.mentionCount ?? 1,
          facts: facts.slice(0, 6),
        });
        break;
      case "technology":
        snapshot.technologies.push({ name: entity.name, mentions: entity.mentionCount ?? 1 });
        break;
      case "organization":
        snapshot.organizations.push({ name: entity.name, mentions: entity.mentionCount ?? 1 });
        break;
      case "preference":
        // Collect raw preference values as bullet points
        for (const f of facts) snapshot.preferences.push(`${entity.name} — ${f}`);
        if (facts.length === 0) snapshot.preferences.push(entity.name);
        break;
    }
  }

  // ── 4. Recent conversation topics (last 10 assistant turns, trimmed) ──────
  const recentMsgs = await db
    .select({ content: conversations.content })
    .from(conversations)
    .where(eq(conversations.role, "assistant"))
    .orderBy(desc(conversations.createdAt))
    .limit(10);

  snapshot.recentTopics = recentMsgs.map((m) =>
    m.content.replace(/\s+/g, " ").slice(0, 120).trim()
  );

  return snapshot;
}

// ── Profile render helpers ────────────────────────────────────────────────────
function renderSnapshot(snap: GraphSnapshot): string {
  const lines: string[] = [];

  if (snap.people.length > 0) {
    lines.push("## People");
    for (const p of snap.people.slice(0, 10)) {
      const aliasStr = p.aliases.length > 0 ? ` (also known as: ${p.aliases.join(", ")})` : "";
      lines.push(`- **${p.name}**${aliasStr} — mentioned ${p.mentions}×`);
      for (const f of p.facts) lines.push(`  • ${f}`);
    }
  }

  if (snap.projects.length > 0) {
    lines.push("\n## Projects");
    for (const p of snap.projects.slice(0, 8)) {
      lines.push(`- **${p.name}** — mentioned ${p.mentions}×`);
      for (const f of p.facts) lines.push(`  • ${f}`);
    }
  }

  if (snap.technologies.length > 0) {
    const techNames = snap.technologies
      .slice(0, 15)
      .map((t) => t.name)
      .join(", ");
    lines.push(`\n## Technologies\n${techNames}`);
  }

  if (snap.organizations.length > 0) {
    const orgNames = snap.organizations
      .slice(0, 8)
      .map((o) => o.name)
      .join(", ");
    lines.push(`\n## Organizations\n${orgNames}`);
  }

  if (snap.preferences.length > 0) {
    lines.push("\n## Preferences & Habits");
    for (const pref of snap.preferences.slice(0, 10)) lines.push(`- ${pref}`);
  }

  if (snap.recentTopics.length > 0) {
    lines.push("\n## Recently Discussed");
    for (const topic of snap.recentTopics.slice(0, 5)) lines.push(`- "${topic}"`);
  }

  lines.push(
    `\n## Stats\n${snap.totalEntities} entities · ${snap.totalFacts} relationship facts`
  );

  return lines.join("\n");
}

// ── Rebuild ───────────────────────────────────────────────────────────────────
export async function rebuildProfile(interactionCount: number): Promise<void> {
  const snap = await buildGraphSnapshot();

  if (snap.totalEntities === 0) return; // Nothing to summarise yet

  const graphText = renderSnapshot(snap);

  const prompt = `You are writing a personal profile summary for an AI assistant to use as context.

Below is a structured knowledge graph extracted from real conversations. Synthesize it into a natural-language profile of the user (Meet). Write in third person. Be specific and factual — only include what the graph confirms. Target ~400 tokens. Use clear paragraphs, no bullet points in the final prose.

${graphText}

Write the profile now:`;

  try {
    const { text } = await generateText({
      model: extractionModel,
      prompt,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(60_000),
    });

    const summaryText = text.trim();
    if (!summaryText) return;

    // Persist facts[] as a structured array for future graph queries
    const facts: string[] = [
      ...snap.people.flatMap((p) => p.facts.map((f) => `${p.name}: ${f}`)),
      ...snap.projects.flatMap((p) => p.facts.map((f) => `${p.name}: ${f}`)),
      ...snap.preferences,
    ].slice(0, 100);

    const existing = await db.select({ id: profile.id }).from(profile).limit(1);

    if (existing[0]) {
      await db
        .update(profile)
        .set({
          summaryText,
          facts,
          interactionCountAtRebuild: interactionCount,
          lastRebuilt: new Date(),
        })
        .where(eq(profile.id, existing[0].id));
    } else {
      await db.insert(profile).values({
        summaryText,
        facts,
        interactionCountAtRebuild: interactionCount,
      });
    }

    // Invalidate hot cache
    hot.delete(HOT_KEY.profile());
    hot.delete(HOT_KEY.profileFacts());
  } catch {
    // Non-fatal — profile rebuild never blocks the chat pipeline
  }
}

// ── Facts accessor ────────────────────────────────────────────────────────────
// Used by prompt-builder for fast fact injection without full profile text.
export async function getProfileFacts(): Promise<string[]> {
  const cached = hot.get<string[]>(HOT_KEY.profileFacts());
  if (cached !== null) return cached;

  const rows = await db.select({ facts: profile.facts }).from(profile).limit(1);
  const facts = (rows[0]?.facts as string[]) ?? [];
  hot.set(HOT_KEY.profileFacts(), facts, HOT_TTL.PROFILE);
  return facts;
}
