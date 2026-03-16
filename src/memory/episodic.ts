import { db } from "@/db";
import { conversations, sessions } from "@/db/schema";
import { eq, desc, isNotNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { generateText } from "ai";
import { extractionModel } from "@/agent/ollama";

export async function logMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  channel = "chat"
): Promise<void> {
  const words = content.split(/\s+/).length;
  const tokenCount = Math.ceil(words * 1.3); // rough estimate

  await db.insert(conversations).values({
    sessionId,
    role,
    content,
    channel,
    tokenCount,
  });
}

export async function getRecentMessages(
  sessionId: string,
  limit = 20
): Promise<Array<{ role: string; content: string }>> {
  const rows = await db
    .select({ role: conversations.role, content: conversations.content })
    .from(conversations)
    .where(eq(conversations.sessionId, sessionId))
    .orderBy(desc(conversations.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function createSession(channel = "chat"): Promise<string> {
  const id = randomUUID();
  await db.insert(sessions).values({ id, channel });
  return id;
}

/**
 * Fetch the last N turns across ALL sessions (for injecting into system prompt).
 */
export async function getRecentHistoryAllSessions(
  limit = 30
): Promise<Array<{ role: string; content: string; createdAt: Date; sessionId: string }>> {
  const rows = await db
    .select({
      role: conversations.role,
      content: conversations.content,
      createdAt: conversations.createdAt,
      sessionId: conversations.sessionId,
    })
    .from(conversations)
    .orderBy(desc(conversations.createdAt))
    .limit(limit);

  return rows.reverse(); // chronological order
}

/**
 * Fetch summaries from recent past sessions.
 */
export async function getRecentSessionSummaries(limit = 5): Promise<string[]> {
  const rows = await db
    .select({ summary: sessions.summary, startedAt: sessions.startedAt })
    .from(sessions)
    .where(isNotNull(sessions.summary))
    .orderBy(desc(sessions.startedAt))
    .limit(limit);

  return rows
    .filter((r) => r.summary)
    .map((r) => {
      const date = new Date(r.startedAt).toLocaleDateString("en", {
        month: "short", day: "numeric",
      });
      return `[${date}] ${r.summary}`;
    });
}

export async function incrementSessionTurns(sessionId: string): Promise<void> {
  const row = await db
    .select({ turnCount: sessions.turnCount })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (row[0]) {
    await db
      .update(sessions)
      .set({ turnCount: (row[0].turnCount ?? 0) + 1 })
      .where(eq(sessions.id, sessionId));
  }
}

export async function summarizeSession(sessionId: string): Promise<string | null> {
  // Check if already summarized
  const existing = await db
    .select({ summary: sessions.summary })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (existing[0]?.summary) return existing[0].summary;

  const messages = await getRecentMessages(sessionId, 40);
  if (messages.length < 2) return null;

  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Summarize this conversation in 2-3 sentences. Focus on: what was discussed, decisions made, and any important facts or tasks. Be concise and factual.

Conversation:
${transcript.slice(0, 3000)}

Summary:`;

  try {
    const { text } = await generateText({ model: extractionModel, prompt, temperature: 0 });

    await db
      .update(sessions)
      .set({ summary: text.trim(), endedAt: new Date() })
      .where(eq(sessions.id, sessionId));

    return text.trim();
  } catch {
    return null;
  }
}
