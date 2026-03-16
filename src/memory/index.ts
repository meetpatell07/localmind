import { logMessage, incrementSessionTurns, getRecentHistoryAllSessions, getRecentSessionSummaries } from "./episodic";
import { embedAndStore, searchSimilar } from "./semantic";
import { processExtractedEntities, getEntityContext } from "./entity";
import { getProfile, maybeRebuildProfile } from "./profile";
import { extractEntitiesFromConversation } from "@/agent/extract";
import { runDecayCycle } from "./decay";
import type { MemoryContext, RecentTurn } from "@/shared/types";
// Re-export ExtractionResult type for callers
export type { ExtractionResult } from "@/agent/extract";

/** Run decay cycle every 25 interactions — cheap math, no LLM calls. */
const DECAY_CYCLE_INTERVAL = 25;

let globalInteractionCount = 0;

// Detect queries asking about past conversations
function isMetaMemoryQuery(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("last time") ||
    lower.includes("previously") ||
    lower.includes("before") ||
    lower.includes("earlier") ||
    lower.includes("remember when") ||
    lower.includes("what did we") ||
    lower.includes("what have we") ||
    lower.includes("what did i tell") ||
    lower.includes("what did i say") ||
    lower.includes("did i mention") ||
    lower.includes("recall") ||
    lower.includes("past conversation") ||
    lower.includes("history") ||
    lower.includes("talked about")
  );
}

/**
 * Recall relevant context for a user message.
 * Called before generating a response.
 */
export async function recall(userMessage: string): Promise<MemoryContext> {
  const meta = isMetaMemoryQuery(userMessage);

  // Always fetch: profile + recent history + session summaries
  // For meta queries, fetch more history; otherwise fetch less
  const historyLimit = meta ? 40 : 20;

  const [profileText, relevantMemories, recentHistoryRaw, sessionSummaries] = await Promise.all([
    getProfile(),
    searchSimilar(userMessage),
    getRecentHistoryAllSessions(historyLimit),
    getRecentSessionSummaries(5),
  ]);

  // Extract entity names from the query for targeted lookup
  const entityNames = extractMentionedNames(userMessage);
  const relevantEntities = await getEntityContext(entityNames);

  const recentHistory: RecentTurn[] = recentHistoryRaw.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
    createdAt: r.createdAt.toISOString(),
    sessionId: r.sessionId,
  }));

  return {
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

export { getProfile } from "./profile";
export { searchSimilar } from "./semantic";
export { createSession } from "./episodic";
