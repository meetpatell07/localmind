/**
 * Proactive Notification Worker
 *
 * Runs as a long-lived setInterval inside the Next.js dev server process.
 * Every 5 minutes, checks for tasks due within 2 hours and fires Telegram
 * notifications with L3/L4 memory context ("proactive offers").
 *
 * Started via src/instrumentation.ts on server boot.
 * Uses globalThis flag to survive HMR without spawning duplicate intervals.
 */

import { db } from "@/db";
import { tasks, entities, relationships, settings } from "@/db/schema";
import { and, eq, gte, lte, or, ilike, inArray, sql } from "drizzle-orm";
import { sendMessage } from "@/connectors/telegram";
import { summarizeStaleSessions } from "@/memory/episodic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DueTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date;
  priority: string | null;
  status: string;
}

interface RelatedEntity {
  id: string;
  name: string;
  type: string;
}

// ── In-memory dedup: taskId → epoch ms when notification was last sent ────────
// Persists across HMR restarts because it lives on globalThis.
const g = globalThis as typeof globalThis & {
  __notifWorkerStarted?: boolean;
  __notifSentMap?: Map<string, number>;
};

function getSentMap(): Map<string, number> {
  if (!g.__notifSentMap) g.__notifSentMap = new Map();
  return g.__notifSentMap;
}

// Re-notify at most once per hour for the same task
const RESEND_INTERVAL_MS = 60 * 60 * 1000;

// ── Core check ────────────────────────────────────────────────────────────────

export async function checkAndNotifyDueTasks(): Promise<void> {
  try {
    const now = new Date();
    const twoHoursOut = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // ── 1. Find tasks due within 2 hours ──────────────────────────────────────
    const dueTasks = await db
      .select({
        id:          tasks.id,
        title:       tasks.title,
        description: tasks.description,
        dueDate:     tasks.dueDate,
        priority:    tasks.priority,
        status:      tasks.status,
      })
      .from(tasks)
      .where(
        and(
          sql`${tasks.dueDate} IS NOT NULL`,
          gte(tasks.dueDate, now),
          lte(tasks.dueDate, twoHoursOut),
          or(eq(tasks.status, "todo"), eq(tasks.status, "in_progress")),
        ),
      ) as DueTask[];

    if (dueTasks.length === 0) return;

    // ── 2. Find active Telegram chat IDs from settings table ─────────────────
    const sessionRows = await db.execute<{ key: string }>(
      sql`SELECT key FROM settings WHERE key LIKE 'telegram:session:%'`,
    );

    const chatIds = sessionRows.rows
      .map((r) => {
        const match = r.key.match(/telegram:session:(-?\d+)/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((id): id is number => id !== null);

    if (chatIds.length === 0) return;

    const sentMap = getSentMap();

    // ── 3. Process each due task ──────────────────────────────────────────────
    for (const task of dueTasks) {
      const nowMs = Date.now();
      const lastSent = sentMap.get(task.id);

      // Skip if already notified recently
      if (lastSent && nowMs - lastSent < RESEND_INTERVAL_MS) continue;

      const relatedEntities = await findRelatedEntities(task.title);
      const message = buildNotificationMessage(task, relatedEntities);

      for (const chatId of chatIds) {
        await sendMessage(chatId, message);
      }

      sentMap.set(task.id, nowMs);
      console.log(
        `[notification-worker] Sent notification for task "${task.title}" to ${chatIds.length} chat(s)`,
      );
    }
  } catch (err) {
    // Non-fatal — log and continue
    console.error("[notification-worker] checkAndNotifyDueTasks error:", err);
  }
}

// ── Entity context from L3 ────────────────────────────────────────────────────

async function findRelatedEntities(title: string): Promise<RelatedEntity[]> {
  // Extract meaningful keywords (3+ chars, ignore stop words)
  const stopWords = new Set(["the", "and", "for", "with", "this", "that", "from", "have", "will"]);
  const keywords = title
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w.toLowerCase()));

  if (keywords.length === 0) return [];

  // Match entity names against task title keywords
  const orConditions = keywords.map((kw) => ilike(entities.name, `%${kw}%`));

  const directMatches = await db
    .select({ id: entities.id, name: entities.name, type: entities.type })
    .from(entities)
    .where(or(...orConditions))
    .limit(4);

  if (directMatches.length === 0) return [];

  // Pull in 1-hop graph neighbors for richer context
  const neighborRels = await db
    .select({
      objectEntityId: relationships.objectEntityId,
      predicate:      relationships.predicate,
    })
    .from(relationships)
    .where(
      and(
        inArray(relationships.subjectId, directMatches.map((e) => e.id)),
        eq(relationships.isActive, true),
      ),
    )
    .limit(8);

  const neighborIds = neighborRels
    .map((r) => r.objectEntityId)
    .filter((id): id is string => id !== null);

  let neighbors: RelatedEntity[] = [];
  if (neighborIds.length > 0) {
    neighbors = await db
      .select({ id: entities.id, name: entities.name, type: entities.type })
      .from(entities)
      .where(inArray(entities.id, neighborIds))
      .limit(3);
  }

  // Return direct matches first, then neighbors (deduped)
  const seen = new Set(directMatches.map((e) => e.id));
  return [
    ...directMatches,
    ...neighbors.filter((n) => !seen.has(n.id)),
  ].slice(0, 4);
}

// ── Message builder ────────────────────────────────────────────────────────────

function buildNotificationMessage(task: DueTask, related: RelatedEntity[]): string {
  const minutesUntilDue = Math.round(
    (task.dueDate.getTime() - Date.now()) / 60_000,
  );
  const timeLabel =
    minutesUntilDue < 60
      ? `in <b>${minutesUntilDue} min${minutesUntilDue === 1 ? "" : "s"}</b>`
      : `in <b>${Math.round(minutesUntilDue / 60)}h</b>`;

  const priorityLabel =
    task.priority === "high"
      ? "🔴 high priority"
      : task.priority === "low"
        ? "⚪ low priority"
        : "🟡 medium priority";

  let msg = `⏰ <b>Task due soon</b>\n\n`;
  msg += `<b>${escapeHtml(task.title)}</b>\n`;
  msg += `Due ${timeLabel} · ${priorityLabel}\n`;

  if (task.description) {
    const snippet = task.description.slice(0, 100);
    msg += `\n<i>${escapeHtml(snippet)}${task.description.length > 100 ? "…" : ""}</i>\n`;
  }

  // ── Proactive offer using L3 entity context ────────────────────────────────
  if (related.length > 0) {
    const primary = related[0];
    const mentions = related
      .slice(0, 2)
      .map((e) => `<b>${escapeHtml(e.name)}</b>`)
      .join(" and ");

    msg += `\n💡 I see this involves ${mentions}. `;

    // Tailor the offer to the entity type
    if (primary.type === "project") {
      msg += `Should I pull up your notes on <b>${escapeHtml(primary.name)}</b>?`;
    } else if (primary.type === "person") {
      msg += `Should I check your recent conversations about <b>${escapeHtml(primary.name)}</b>?`;
    } else if (primary.type === "organization") {
      msg += `Should I search my memory for context on <b>${escapeHtml(primary.name)}</b>?`;
    } else if (primary.type === "technology") {
      msg += `Want me to recall what I know about <b>${escapeHtml(primary.name)}</b>?`;
    } else {
      msg += `Want me to recall everything I know about <b>${escapeHtml(primary.name)}</b>?`;
    }
    msg += "\n";
  }

  msg += `\n<code>Reply with your question or /clear to dismiss.</code>`;
  return msg;
}

// ── HTML escape (mirrors telegram.ts) ─────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Worker lifecycle ──────────────────────────────────────────────────────────

export function startNotificationWorker(): void {
  if (g.__notifWorkerStarted) return;
  g.__notifWorkerStarted = true;

  console.log(
    "[notification-worker] Started — checking every 5 minutes for tasks due within 2 hours",
  );

  // Initial check after 30 s (let the server fully boot first)
  setTimeout(() => {
    checkAndNotifyDueTasks().catch(() => {});
    summarizeStaleSessions()
      .then((n) => { if (n > 0) console.log(`[session-summarizer] Auto-summarized ${n} stale session(s)`); })
      .catch(() => {});
  }, 30_000);

  // Recurring check every 5 minutes
  setInterval(() => {
    checkAndNotifyDueTasks().catch(() => {});
    summarizeStaleSessions()
      .then((n) => { if (n > 0) console.log(`[session-summarizer] Auto-summarized ${n} stale session(s)`); })
      .catch(() => {});
  }, 5 * 60 * 1000);
}
