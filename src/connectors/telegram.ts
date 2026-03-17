/**
 * Telegram Bot API helpers
 *
 * Handles:
 *  - Sending messages / typing actions
 *  - Per-chat session and history management (persisted in settings table)
 *  - Markdown → Telegram HTML conversion
 *  - Message splitting (4096-char limit)
 */

import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = () => {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");
  return `https://api.telegram.org/bot${BOT_TOKEN}`;
};

// ── Stored message shape (lean — avoids serializing complex UIMessage parts) ──
export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Telegram Bot API ──────────────────────────────────────────────────────────

export async function sendMessage(
  chatId: number,
  text: string,
  parseMode: "HTML" | undefined = "HTML"
): Promise<void> {
  const chunks = splitMessage(text.trim(), 4000);
  for (const chunk of chunks) {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: chunk,
    };
    if (parseMode) body.parse_mode = parseMode;

    const res = await fetch(`${TG_API()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // If HTML parse failed, retry as plain text
    if (!res.ok && parseMode === "HTML") {
      await fetch(`${TG_API()}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: stripHtmlTags(chunk) }),
      }).catch(() => {});
    }
  }
}

export async function sendTypingAction(chatId: number): Promise<void> {
  await fetch(`${TG_API()}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {}); // non-fatal
}

export async function setWebhook(
  url: string,
  secret?: string
): Promise<unknown> {
  const body: Record<string, unknown> = { url };
  if (secret) body.secret_token = secret;
  const res = await fetch(`${TG_API()}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteWebhook(): Promise<unknown> {
  const res = await fetch(`${TG_API()}/deleteWebhook`, { method: "POST" });
  return res.json();
}

export async function getWebhookInfo(): Promise<unknown> {
  const res = await fetch(`${TG_API()}/getWebhookInfo`);
  return res.json();
}

// ── Session management ────────────────────────────────────────────────────────

const SESSION_KEY = (chatId: number) => `telegram:session:${chatId}`;
const HISTORY_KEY = (chatId: number) => `telegram:history:${chatId}`;
const MAX_HISTORY = 20; // keep last 20 turns

export async function getOrCreateSession(chatId: number): Promise<string> {
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, SESSION_KEY(chatId)))
    .limit(1);

  if (row[0]?.value) {
    return (row[0].value as { sessionId: string }).sessionId;
  }

  const sessionId = crypto.randomUUID();
  await db
    .insert(settings)
    .values({ key: SESSION_KEY(chatId), value: { sessionId } })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { sessionId }, updatedAt: new Date() },
    });

  return sessionId;
}

export async function loadChatHistory(
  chatId: number
): Promise<StoredMessage[]> {
  const row = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, HISTORY_KEY(chatId)))
    .limit(1);

  return (
    (row[0]?.value as { messages: StoredMessage[] } | null)?.messages ?? []
  );
}

export async function saveChatHistory(
  chatId: number,
  messages: StoredMessage[]
): Promise<void> {
  const trimmed = messages.slice(-MAX_HISTORY);
  await db
    .insert(settings)
    .values({ key: HISTORY_KEY(chatId), value: { messages: trimmed } })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { messages: trimmed }, updatedAt: new Date() },
    });
}

export async function clearChatHistory(chatId: number): Promise<void> {
  await Promise.all([
    db.delete(settings).where(eq(settings.key, HISTORY_KEY(chatId))),
    db.delete(settings).where(eq(settings.key, SESSION_KEY(chatId))),
  ]);
}

// ── Markdown → Telegram HTML ──────────────────────────────────────────────────
// Strategy:
//  1. Extract code blocks/inline code → replace with placeholders (protected)
//  2. HTML-escape the remaining text (&, <, >)
//  3. Apply bold/italic markdown to the escaped text
//  4. Restore code blocks (already HTML-escaped inside)

export function toTelegramHtml(md: string): string {
  const blocks: string[] = [];

  // 1. Protect fenced code blocks
  let text = md.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => {
    const idx = blocks.length;
    blocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `\x00B${idx}\x00`;
  });

  // 2. Protect inline code
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = blocks.length;
    blocks.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00B${idx}\x00`;
  });

  // 3. HTML-escape remaining text
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 4. Apply bold / italic
  text = text
    .replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>")
    .replace(/(?<!\*)\*(?!\*)([\s\S]+?)(?<!\*)\*(?!\*)/g, "<i>$1</i>")
    .replace(/__([\s\S]*?)__/g, "<b>$1</b>")
    .replace(/_([^_\n]+)_/g, "<i>$1</i>");

  // 5. Restore protected blocks
  text = text.replace(/\x00B(\d+)\x00/g, (_, idx) => blocks[parseInt(idx)]);

  return text;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function splitMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    // Prefer splitting at double-newline (paragraph), then single newline
    let splitAt = remaining.lastIndexOf("\n\n", maxLen);
    if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < 1) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}
