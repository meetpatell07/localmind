import { logMessage, incrementSessionTurns, getRecentHistoryAllSessions, getRecentSessionSummaries } from "./episodic";
import { embedAndStore, searchSimilar } from "./semantic";
import { processExtractedEntities, getEntityContext } from "./entity";
import { getProfile, maybeRebuildProfile } from "./profile";
import { extractEntitiesFromConversation } from "@/agent/extract";
import { runDecayCycle } from "./decay";
import { hot, HOT_KEY, HOT_TTL } from "./hot";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
import type { MemoryContext, RecentTurn, UserIdentity, EntityWithRelationships } from "@/shared/types";
// Re-export ExtractionResult type for callers
export type { ExtractionResult } from "@/agent/extract";

/** Run decay cycle every 25 interactions — cheap math, no LLM calls. */
const DECAY_CYCLE_INTERVAL = 25;

let globalInteractionCount = 0;

// ── Query intent classification — pure JS, zero latency ───────────────────────
type QueryIntent = "identity" | "simple" | "context";

function classifyIntent(msg: string): QueryIntent {
  const lower = msg.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  // Identity: asking about the user's own profile fields
  const identityKeywords = [
    "linkedin", "portfolio", "website", "instagram", "twitter", "facebook",
    "x handle", "phone", "address", "email", "my name", "who am i",
    "my profile", "my info", "my details", "my contact",
  ];
  if (identityKeywords.some((k) => lower.includes(k))) return "identity";

  // Context: needs semantic recall of past conversations/projects
  const contextKeywords = [
    "last time", "previously", "remember when", "what did we", "what did i",
    "did i mention", "recall", "past", "history", "talked about", "told you",
    "project", "deadline", "meeting", "earlier", "before", "what have we",
    "what was", "when did", "remind me", "used to",
  ];
  if (contextKeywords.some((k) => lower.includes(k))) return "context";

  // Simple: short messages, greetings, actions
  if (wordCount <= 8) return "simple";

  // Default to context for longer queries (may need recall)
  return "context";
}

// ── Load userIdentity from hot cache or DB ────────────────────────────────────
async function loadUserIdentity(): Promise<UserIdentity | null> {
  const cached = hot.get<UserIdentity>(HOT_KEY.userIdentity());
  if (cached) return cached;

  const rows = await db.select().from(userProfile).limit(1);
  if (!rows[0]) return null;

  const identity: UserIdentity = {
    displayName:  rows[0].displayName,
    email:        rows[0].email,
    phone:        rows[0].phone,
    address:      rows[0].address,
    linkedin:     rows[0].linkedin,
    portfolioWeb: rows[0].portfolioWeb,
    instagram:    rows[0].instagram,
    xHandle:      rows[0].xHandle,
    facebook:     rows[0].facebook,
  };
  hot.set(HOT_KEY.userIdentity(), identity, HOT_TTL.USER_IDENTITY);
  return identity;
}

/**
 * Invalidate the cached user identity — call after Settings > Profile is updated.
 */
export function invalidateUserIdentityCache(): void {
  hot.delete(HOT_KEY.userIdentity());
}

/**
 * Recall relevant context for a user message.
 * Uses tiered loading based on query intent to avoid unnecessary expensive ops.
 */
export async function recall(userMessage: string): Promise<MemoryContext> {
  const intent = classifyIntent(userMessage);

  // Tier A — always loaded (all fast: hot cache or small DB queries)
  const historyLimit = intent === "context" ? 20 : intent === "simple" ? 5 : 3;

  const [userIdentity, profileText, recentHistoryRaw, sessionSummaries] = await Promise.all([
    loadUserIdentity(),
    getProfile(),
    getRecentHistoryAllSessions(historyLimit),
    intent === "context" ? getRecentSessionSummaries(5) : Promise.resolve([] as string[]),
  ]);

  // Tier B — only for context queries (the expensive ops)
  let relevantMemories: string[] = [];
  let relevantEntities: EntityWithRelationships[] = [];

  if (intent === "context") {
    const entityNames = extractMentionedNames(userMessage);
    [relevantMemories, relevantEntities] = await Promise.all([
      searchSimilar(userMessage),
      getEntityContext(entityNames),
    ]);
  }

  const recentHistory: RecentTurn[] = recentHistoryRaw.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    sessionId: r.sessionId,
  }));

  return {
    userIdentity,
    profile: profileText,
    relevantMemories,
    relevantEntities,
    recentHistory,
    sessionSummaries,
  };
}

/**
 * Persist conversation turns to all memory layers.
 * Called async AFTER streaming response completes.
 */
export async function remember(
  sessionId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  globalInteractionCount++;

  // L1: Episodic log
  await Promise.all([
    logMessage(sessionId, "user", userMessage),
    logMessage(sessionId, "assistant", assistantMessage),
    incrementSessionTurns(sessionId),
  ]);

  // L2: Semantic embeddings (run in parallel)
  const combinedText = `User: ${userMessage}\nAssistant: ${assistantMessage}`;
  await embedAndStore(combinedText, "conversation");

  // L3: Entity extraction (async, fire-and-forget style but we await in the pipeline)
  const extracted = await extractEntitiesFromConversation(userMessage, assistantMessage);
  if (extracted) {
    await processExtractedEntities(extracted);
  }

  // L4: Maybe rebuild profile
  await maybeRebuildProfile(globalInteractionCount);

  // Decay: recompute scores every 25 interactions (fire-and-forget)
  if (globalInteractionCount % DECAY_CYCLE_INTERVAL === 0) {
    runDecayCycle().catch(() => {});
  }
}

/**
 * Simple heuristic: extract proper nouns / capitalized words as potential entity names.
 */
function extractMentionedNames(text: string): string[] {
  const words = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  return [...new Set(words)].slice(0, 5);
}

/**
 * Fast context for tool-driven chat — only hot-cached data, no DB reads.
 * Used by the main chat route; the AI fetches deeper context via tools when needed.
 */
export async function recallFast(): Promise<MemoryContext> {
  const [userIdentity, profile] = await Promise.all([
    loadUserIdentity(),
    getProfile(),
  ]);
  return {
    userIdentity,
    profile,
    relevantMemories: [],
    relevantEntities: [],
    recentHistory:    [],
    sessionSummaries: [],
  };
}

export { getProfile } from "./profile";
export { searchSimilar } from "./semantic";
export { createSession } from "./episodic";
