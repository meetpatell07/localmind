import { db } from "@/db";
import { conversations, sessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

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
