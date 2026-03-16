import { logMessage, incrementSessionTurns } from "./episodic";
import { embedAndStore, searchSimilar } from "./semantic";
import { processExtractedEntities, getEntityContext } from "./entity";
import { getProfile, maybeRebuildProfile } from "./profile";
import { extractEntitiesFromConversation } from "@/agent/extract";
import type { MemoryContext } from "@/shared/types";

let globalInteractionCount = 0;

/**
 * Recall relevant context for a user message.
 * Called before generating a response.
 */
export async function recall(userMessage: string): Promise<MemoryContext> {
  const [profileText, relevantMemories] = await Promise.all([
    getProfile(),
    searchSimilar(userMessage),
  ]);

  // Extract entity names from the query for targeted lookup
  const entityNames = extractMentionedNames(userMessage);
  const relevantEntities = await getEntityContext(entityNames);

  return {
    profile: profileText,
    relevantMemories,
    relevantEntities,
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
