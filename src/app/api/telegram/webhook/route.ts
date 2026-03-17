/**
 * Telegram Webhook — POST /api/telegram/webhook
 *
 * Telegram sends every update here. We:
 *  1. Verify the secret token header
 *  2. Parse the incoming message
 *  3. Handle /commands instantly
 *  4. For regular text: run through the same AI pipeline as the web chat
 *     (streamText + coreTools + full memory pipeline)
 *  5. Send the response back via Telegram Bot API
 *  6. Always return 200 quickly so Telegram doesn't retry
 */

import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import { chatModel } from "@/agent/ollama";
import { coreTools } from "@/agent/tools";
import { buildSystemPrompt } from "@/agent/prompt-builder";
import { recallFast, remember, createSession } from "@/memory";
import {
  sendMessage,
  sendTypingAction,
  getOrCreateSession,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  toTelegramHtml,
  type StoredMessage,
} from "@/connectors/telegram";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// ── Telegram Update schema (only what we use) ─────────────────────────────────
const TelegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      from: z
        .object({
          id: z.number(),
          first_name: z.string(),
          username: z.string().optional(),
        })
        .optional(),
      chat: z.object({ id: z.number(), type: z.string() }),
      text: z.string().optional(),
      date: z.number(),
    })
    .optional(),
});

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Telegram sends this header when you set a secret_token during setWebhook
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (incoming !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("OK", { status: 200 });
  }

  const parsed = TelegramUpdateSchema.safeParse(body);

  // Non-message updates (edits, reactions, etc.) — just acknowledge
  if (!parsed.success || !parsed.data.message) {
    return new Response("OK", { status: 200 });
  }

  const { message } = parsed.data;
  const text = message.text?.trim();

  if (!text) return new Response("OK", { status: 200 });

  const chatId = message.chat.id;

  // ── Handle commands ────────────────────────────────────────────────────────
  if (text === "/start") {
    await sendMessage(
      chatId,
      `<b>LocalMind connected.</b>\n\nI'm your personal AI. I remember you across sessions, manage your tasks, and can access your Gmail and Calendar.\n\n<b>Commands</b>\n/clear — Reset conversation\n/memory — Show what I know about you\n/help — Show commands\n\nWhat can I help you with?`
    );
    return new Response("OK", { status: 200 });
  }

  if (text === "/clear") {
    await clearChatHistory(chatId);
    await sendMessage(chatId, "Conversation reset. Starting fresh.");
    return new Response("OK", { status: 200 });
  }

  if (text === "/memory") {
    // Fire off an AI message that will call get_my_profile + recall_memories
    processMessage(chatId, "What do you know about me? Show my profile and any key memories.").catch(
      () => {}
    );
    return new Response("OK", { status: 200 });
  }

  if (text === "/help") {
    await sendMessage(
      chatId,
      `<b>LocalMind — Commands</b>\n\n/start — Welcome\n/clear — Reset conversation\n/memory — What I know about you\n/help — This message\n\n<b>Just talk naturally</b> — I can:\n• Answer questions using your memory\n• Create and manage tasks\n• Remember new information\n• Search your knowledge graph\n• Check your Gmail and Calendar (if connected)`
    );
    return new Response("OK", { status: 200 });
  }

  // ── Process regular message async ─────────────────────────────────────────
  // Return 200 immediately so Telegram doesn't retry while we're processing
  processMessage(chatId, text).catch(async (err) => {
    console.error("[telegram/webhook] processMessage error:", err);
    await sendMessage(
      chatId,
      "Something went wrong. Is Ollama running? Try again in a moment."
    ).catch(() => {});
  });

  return new Response("OK", { status: 200 });
}

// ── Core message processor ────────────────────────────────────────────────────

async function processMessage(chatId: number, userText: string): Promise<void> {
  // Send typing indicator right away
  await sendTypingAction(chatId);

  // Load session + conversation history in parallel
  const [sessionId, storedHistory] = await Promise.all([
    getOrCreateSession(chatId),
    loadChatHistory(chatId),
  ]);

  // Convert stored history → UIMessage array
  const historyMessages: UIMessage[] = storedHistory.map((m) => ({
    id: crypto.randomUUID(),
    role: m.role,
    parts: [{ type: "text" as const, text: m.content }],
  }));

  // Add the new user message
  const userMessage: UIMessage = {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text: userText }],
  };
  const allMessages: UIMessage[] = [...historyMessages, userMessage];

  // Load memory context (fast: hot-cached profile + identity)
  let memoryCtx;
  try {
    memoryCtx = await recallFast();
  } catch {
    memoryCtx = {
      userIdentity:     null,
      profile:          null,
      relevantMemories: [],
      relevantEntities: [],
      recentHistory:    [],
      sessionSummaries: [],
    };
  }

  const systemPrompt = buildSystemPrompt(memoryCtx);
  const modelMessages = await convertToModelMessages(allMessages);

  // Keep typing indicator alive for longer requests (Telegram shows it for ~5s)
  const typingInterval = setInterval(() => {
    sendTypingAction(chatId).catch(() => {});
  }, 4_500);

  let responseText = "";
  try {
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: modelMessages,
      tools: coreTools,
      stopWhen: stepCountIs(5),
      temperature: 0.7,
      onFinish: async ({ text }) => {
        // Async memory pipeline — same as web chat
        try {
          await remember(sessionId, userText, text);
        } catch {
          // Non-fatal
        }
      },
    });

    // Await full response (no streaming needed for Telegram)
    responseText = (await result.text).trim();
  } finally {
    clearInterval(typingInterval);
  }

  if (!responseText) {
    await sendMessage(
      chatId,
      "I couldn't generate a response. Please check that Ollama is running."
    );
    return;
  }

  // Send to Telegram with HTML formatting
  await sendMessage(chatId, toTelegramHtml(responseText));

  // Persist updated history
  const updatedHistory: StoredMessage[] = [
    ...storedHistory,
    { role: "user", content: userText },
    { role: "assistant", content: responseText },
  ];
  await saveChatHistory(chatId, updatedHistory);
}

// Needed for new sessions created by getOrCreateSession
// Re-export so callers don't need a separate import
export { createSession };
