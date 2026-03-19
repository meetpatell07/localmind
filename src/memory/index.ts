import { logMessage, incrementSessionTurns, getRecentHistoryAllSessions, getRecentSessionSummaries } from "./episodic";
import { embedAndStore, searchSimilar } from "./semantic";
import { processExtractedEntities, getEntityContext } from "./entity";
import { getProfile, maybeRebuildProfile, getStyleNote, runSelfReflection } from "./profile";
import { extractEntitiesFromConversation } from "@/agent/extract";
import { runDecayCycle } from "./decay";
import { hot, HOT_KEY, HOT_TTL } from "./hot";
import { db } from "@/db";
import { userProfile } from "@/db/schema";
import { SELF_REFLECTION_INTERVAL } from "@/shared/constants";
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
 *
 * Intent routing:
 *   "identity" / "simple"  → single Promise.all: identity + profile + history + styleNote
 *   "context"              → single Promise.all: all 7 sources in one round-trip
 *                            (previously 2 sequential rounds — now ~50 ms faster)
 */
export async function recall(userMessage: string): Promise<MemoryContext> {
  const intent = classifyIntent(userMessage);
  const historyLimit = intent === "context" ? 20 : intent === "simple" ? 5 : 3;

  if (intent !== "context") {
    // Fast path — no semantic search, no entity graph needed
    const [userIdentity, profileText, recentHistoryRaw, styleNote] = await Promise.all([
      loadUserIdentity(),
      getProfile(),
      getRecentHistoryAllSessions(historyLimit),
      getStyleNote(),
    ]);

    return {
      userIdentity,
      profile: profileText,
      relevantMemories: [],
      relevantEntities: [],
      recentHistory: toRecentTurns(recentHistoryRaw),
      sessionSummaries: [],
      styleNote,
    };
  }

  // Context path — all sources in one Promise.all (was 2 sequential rounds)
  const entityNames = extractMentionedNames(userMessage);
  const [
    userIdentity,
    profileText,
    recentHistoryRaw,
    sessionSummaries,
    relevantMemories,
    relevantEntities,
    styleNote,
  ] = await Promise.all([
    loadUserIdentity(),
    getProfile(),
    getRecentHistoryAllSessions(historyLimit),
    getRecentSessionSummaries(5),
    searchSimilar(userMessage),
    getEntityContext(entityNames),
    getStyleNote(),
  ]);

  return {
    userIdentity,
    profile: profileText,
    relevantMemories,
    relevantEntities,
    recentHistory: toRecentTurns(recentHistoryRaw),
    sessionSummaries,
    styleNote,
  };
}

function toRecentTurns(
  rows: Array<{ role: string; content: string; createdAt: Date; sessionId: string }>
): RecentTurn[] {
  return rows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    sessionId: r.sessionId,
  }));
}

/**
 * Persist conversation turns to all memory layers.
 * Called async AFTER streaming response completes.
 *
 * Pipeline (optimized):
 *   L1 (3 parallel writes)
 *   → L2 embed + L3 extract  ← run in parallel; both only need the text
 *   → L3b processEntities    ← sequential: needs extraction result
 *   → L4 maybeRebuildProfile ← sequential: reads entities just written
 *   → self-reflection / decay ← fire-and-forget
 */
export async function remember(
  sessionId: string,
  userMessage: string,
  assistantMessage: string
): Promise<void> {
  globalInteractionCount++;

  // L1: Episodic log — 3 independent writes in parallel
  await Promise.all([
    logMessage(sessionId, "user", userMessage),
    logMessage(sessionId, "assistant", assistantMessage),
    incrementSessionTurns(sessionId),
  ]);

  // L2 + L3 extraction: both need only the message text, fully independent
  const combinedText = `User: ${userMessage}\nAssistant: ${assistantMessage}`;
  const [, extracted] = await Promise.all([
    embedAndStore(combinedText, "conversation"),
    extractEntitiesFromConversation(userMessage, assistantMessage),
  ]);

  // L3b: Persist extracted entities (must follow extraction, but L2 is already done)
  if (extracted) {
    await processExtractedEntities(extracted);
  }

  // L4: Maybe rebuild profile (reads entity table — must follow L3b)
  await maybeRebuildProfile(globalInteractionCount);

  // Self-reflection: infer tone/style every SELF_REFLECTION_INTERVAL messages (fire-and-forget)
  if (globalInteractionCount % SELF_REFLECTION_INTERVAL === 0) {
    runSelfReflection().catch(() => {});
  }

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
  const [userIdentity, profile, styleNote] = await Promise.all([
    loadUserIdentity(),
    getProfile(),
    getStyleNote(),
  ]);
  return {
    userIdentity,
    profile,
    relevantMemories: [],
    relevantEntities: [],
    recentHistory:    [],
    sessionSummaries: [],
    styleNote,
  };
}

export { getProfile } from "./profile";
export { searchSimilar } from "./semantic";
export { createSession } from "./episodic";
