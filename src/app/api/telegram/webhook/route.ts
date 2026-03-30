export const runtime = 'edge';
/**
 * Telegram Webhook — POST /api/telegram/webhook
 *
 * Handles:
 *  1. Secret token verification
 *  2. Text commands: /start /clear /memory /help /tasks /vault /note /remind /search /status
 *  3. File / photo uploads → saved to vault + AI categorized
 *  4. Regular text → full AI pipeline (same as web chat)
 */

import { streamText, convertToModelMessages, stepCountIs } from "ai";
import type { UIMessage } from "ai";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { chatModel } from "@/agent/ollama";
import { allTools } from "@/agent/tools";
import { getNotionTools, shouldUseNotionTools } from "@/connectors/notion-mcp";
import { buildSystemPrompt } from "@/agent/prompt-builder";
import { recallFast, remember, createSession } from "@/memory";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import {
  sendMessage,
  sendTypingAction,
  getOrCreateSession,
  loadChatHistory,
  saveChatHistory,
  clearChatHistory,
  toTelegramHtml,
  downloadTelegramFile,
  type StoredMessage,
} from "@/connectors/telegram";
import {
  ensureVaultDir,
  indexFile,
  getVaultPath,
  listFiles,
  fileExistsByTelegramId,
  updateFileAnalysis,
} from "@/vault/indexer";
import { analyzeFile } from "@/vault/analyzer";
import { transcribeAudio, isTranscriptionAvailable } from "@/connectors/transcribe";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// ── Telegram Update schema ─────────────────────────────────────────────────────

const TelegramFileSchema = z.object({
  file_id: z.string(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
});

const TelegramPhotoSchema = z.object({
  file_id: z.string(),
  file_size: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const TelegramVoiceSchema = z.object({
  file_id: z.string(),
  duration: z.number().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
});

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
      caption: z.string().optional(),
      document: TelegramFileSchema.optional(),
      photo: z.array(TelegramPhotoSchema).optional(),
      voice: TelegramVoiceSchema.optional(),
      date: z.number(),
    })
    .optional(),
});

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (incoming !== WEBHOOK_SECRET) return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return new Response("OK", { status: 200 }); }

  const parsed = TelegramUpdateSchema.safeParse(body);
  if (!parsed.success || !parsed.data.message) return new Response("OK", { status: 200 });

  const { message } = parsed.data;
  const chatId = message.chat.id;
  const text = message.text?.trim();

  // ── Voice note → transcribe → AI prompt ──────────────────────────────────
  const voice = message.voice;
  if (voice) {
    handleVoiceNote(chatId, voice.file_id, voice.duration).catch(async (err) => {
      console.error("[telegram] voice note error:", err);
      await sendMessage(chatId, "❌ Failed to process voice note.").catch(() => {});
    });
    return new Response("OK", { status: 200 });
  }

  // ── File / photo upload ────────────────────────────────────────────────────
  const doc = message.document;
  const photos = message.photo;

  if (doc || (photos && photos.length > 0)) {
    handleFileUpload(chatId, doc ?? undefined, photos ?? undefined, message.caption).catch(async (err) => {
      console.error("[telegram] file upload error:", err);
      await sendMessage(chatId, "❌ Failed to save file. Please try again.").catch(() => {});
    });
    return new Response("OK", { status: 200 });
  }

  if (!text) return new Response("OK", { status: 200 });

  // ── Commands ───────────────────────────────────────────────────────────────

  if (text === "/start") {
    await sendMessage(chatId,
      `<b>LocalMind connected.</b>\n\nYour personal AI, always on.\n\n<b>Commands</b>\n/tasks — Pending tasks\n/vault — Recent files\n/memory — What I know about you\n/status — System status\n/note &lt;text&gt; — Save a note\n/remind &lt;text&gt; — Create a task\n/search &lt;query&gt; — Search memory\n/clear — Reset conversation\n/help — Full command list\n\n<b>Full AI access</b>\n🎙 Send a voice note — I'll transcribe and act on it\n📎 Send any file/photo — saved to your Vault\n💬 Just talk naturally — I can search emails, manage Google Drive, create tasks, access your calendar, and more.`
    );
    return new Response("OK", { status: 200 });
  }

  if (text === "/clear") {
    await clearChatHistory(chatId);
    await sendMessage(chatId, "Conversation reset. Starting fresh.");
    return new Response("OK", { status: 200 });
  }

  if (text === "/memory") {
    processMessage(chatId, "What do you know about me? Show my profile and any key memories.").catch(() => {});
    return new Response("OK", { status: 200 });
  }

  if (text === "/help") {
    await sendMessage(chatId,
      `<b>LocalMind — All Commands</b>\n\n` +
      `<b>Productivity</b>\n/tasks — Show pending tasks\n/remind &lt;text&gt; — Create a task\n` +
      `\n<b>Memory</b>\n/memory — What I know about you\n/note &lt;text&gt; — Save a memory note\n/search &lt;query&gt; — Search memories\n` +
      `\n<b>Files</b>\n/vault — Recent vault files\n<i>Send any file/photo to save it</i>\n` +
      `\n<b>Voice</b>\n🎙 Send a voice note — transcribed and processed by AI\n` +
      `\n<b>System</b>\n/status — Ollama + DB health\n/clear — Reset conversation\n/start — Welcome message\n` +
      `\n<b>Full AI tools available:</b>\n📧 Email — search, read, draft, download attachments\n📁 Google Drive — search and list files\n📅 Calendar — view upcoming events\n📋 Tasks — create, update, manage\n🧠 Memory — save notes, recall context\n📂 Vault — save and organize files\n` +
      `\n<b>Just talk naturally</b> — ask me anything or send a voice note.`
    );
    return new Response("OK", { status: 200 });
  }

  if (text === "/tasks") {
    handleTasksCommand(chatId).catch(() => {});
    return new Response("OK", { status: 200 });
  }

  if (text === "/vault") {
    handleVaultCommand(chatId).catch(() => {});
    return new Response("OK", { status: 200 });
  }

  if (text === "/status") {
    handleStatusCommand(chatId).catch(() => {});
    return new Response("OK", { status: 200 });
  }

  if (text.startsWith("/note ")) {
    const note = text.slice(6).trim();
    if (note) {
      processMessage(chatId, `Remember this: ${note}`).catch(() => {});
    } else {
      await sendMessage(chatId, "Usage: /note &lt;text to remember&gt;");
    }
    return new Response("OK", { status: 200 });
  }

  if (text.startsWith("/remind ")) {
    const taskText = text.slice(8).trim();
    if (taskText) {
      processMessage(chatId, `Create a task: ${taskText}`).catch(() => {});
    } else {
      await sendMessage(chatId, "Usage: /remind &lt;task description&gt;");
    }
    return new Response("OK", { status: 200 });
  }

  if (text.startsWith("/search ")) {
    const query = text.slice(8).trim();
    if (query) {
      processMessage(chatId, `Search my memories for: ${query}`).catch(() => {});
    } else {
      await sendMessage(chatId, "Usage: /search &lt;query&gt;");
    }
    return new Response("OK", { status: 200 });
  }

  // ── Regular AI message ─────────────────────────────────────────────────────
  processMessage(chatId, text).catch(async (err) => {
    console.error("[telegram/webhook] processMessage error:", err);
    await sendMessage(chatId, "Something went wrong. Is Ollama running?").catch(() => {});
  });

  return new Response("OK", { status: 200 });
}

// ── File upload handler ───────────────────────────────────────────────────────

async function handleFileUpload(
  chatId: number,
  doc?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number },
  photos?: { file_id: string; file_size?: number }[],
  caption?: string
): Promise<void> {
  await sendTypingAction(chatId);

  const fileId = doc?.file_id ?? photos?.[photos.length - 1]?.file_id;
  if (!fileId) return;

  // De-duplicate: skip if already saved
  const alreadySaved = await fileExistsByTelegramId(fileId);
  if (alreadySaved) {
    await sendMessage(chatId, "This file is already in your vault.");
    return;
  }

  const downloaded = await downloadTelegramFile(fileId);
  if (!downloaded) {
    await sendMessage(chatId, "❌ Couldn't download the file. It may be too large (Telegram 20 MB limit).");
    return;
  }

  // Save to vault
  await ensureVaultDir();
  const now = new Date();
  const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
  const fullDir = getVaultPath(subDir);
  await fs.mkdir(fullDir, { recursive: true });

  const originalName = doc?.file_name ?? downloaded.fileName;
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}_${safeName}`;
  const relativePath = path.join(subDir, uniqueName);
  const fullPath = getVaultPath(relativePath);

  await fs.writeFile(fullPath, downloaded.buffer);

  const mimeType = doc?.mime_type ?? downloaded.mimeType;
  const record = await indexFile({
    fileName: originalName,
    relativePath,
    mimeType,
    sizeBytes: downloaded.buffer.length,
    source: "telegram",
    telegramFileId: fileId,
    tags: caption ? [caption.slice(0, 50)] : [],
  });

  // Confirm receipt immediately
  await sendMessage(chatId, `✅ <b>${originalName}</b> saved to vault.\n<i>Analyzing with AI…</i>`);

  // Async AI analysis
  analyzeFile({ fileId: record.id, fileName: originalName, mimeType, absolutePath: fullPath })
    .then(async (analysis) => {
      await updateFileAnalysis(record.id, analysis);
      await sendMessage(
        chatId,
        `📁 <b>Categorized as: ${analysis.category}</b>\n${analysis.summary}\n<i>Tags: ${analysis.tags.join(", ")}</i>`
      );
    })
    .catch(() => {});
}

// ── Voice note handler ───────────────────────────────────────────────────────

async function handleVoiceNote(
  chatId: number,
  fileId: string,
  duration?: number
): Promise<void> {
  if (!isTranscriptionAvailable()) {
    await sendMessage(chatId, "Voice notes require a GROQ_API_KEY or OPENAI_API_KEY. Add one to .env.local.");
    return;
  }

  await sendTypingAction(chatId);

  const downloaded = await downloadTelegramFile(fileId);
  if (!downloaded) {
    await sendMessage(chatId, "❌ Couldn't download the voice note.");
    return;
  }

  let result: Awaited<ReturnType<typeof transcribeAudio>>;
  try {
    result = await transcribeAudio(downloaded.buffer, downloaded.fileName);
  } catch (err) {
    console.error("[telegram] transcription failed:", err);
    await sendMessage(chatId, "❌ Transcription service error. Try again or type your message.");
    return;
  }
  if (!result || !result.text) {
    await sendMessage(chatId, "❌ Couldn't transcribe the voice note. Try again or type your message.");
    return;
  }

  const durationStr = duration ? ` (${duration}s)` : "";
  await sendMessage(chatId, `🎙 <i>Heard${durationStr}:</i> "${result.text}"`);

  // Feed the transcribed text through the full AI pipeline
  await processMessage(chatId, result.text);
}

// ── /tasks command ────────────────────────────────────────────────────────────

async function handleTasksCommand(chatId: number): Promise<void> {
  const pendingTasks = await db
    .select({ id: tasks.id, title: tasks.title, priority: tasks.priority, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(ne(tasks.status, "done"), ne(tasks.status, "cancelled")))
    .limit(10);

  if (pendingTasks.length === 0) {
    await sendMessage(chatId, "✅ No pending tasks. You're all caught up!");
    return;
  }

  const priorityEmoji: Record<string, string> = { high: "🔴", medium: "🟡", low: "🟢" };
  const lines = pendingTasks.map((t) => {
    const emoji = priorityEmoji[t.priority ?? "medium"] ?? "•";
    const due = t.dueDate ? ` — due ${new Date(t.dueDate).toLocaleDateString("en", { month: "short", day: "numeric" })}` : "";
    return `${emoji} ${t.title}${due}`;
  });

  await sendMessage(chatId, `<b>Pending Tasks (${pendingTasks.length})</b>\n\n${lines.join("\n")}`);
}

// ── /vault command ────────────────────────────────────────────────────────────

async function handleVaultCommand(chatId: number): Promise<void> {
  const recentFiles = await listFiles();
  const top = recentFiles.slice(0, 8);

  if (top.length === 0) {
    await sendMessage(chatId, "Vault is empty. Send me any file to save it.");
    return;
  }

  const lines = top.map((f) => {
    const cat = f.category ? ` [${f.category}]` : "";
    const src = f.source === "telegram" ? " 📱" : "";
    return `• <b>${f.fileName}</b>${cat}${src}`;
  });

  await sendMessage(chatId, `<b>Recent Vault Files</b>\n\n${lines.join("\n")}\n\n<i>Send any file to add it.</i>`);
}

// ── /status command ───────────────────────────────────────────────────────────

async function handleStatusCommand(chatId: number): Promise<void> {
  const [ollamaRes, filesRes] = await Promise.allSettled([
    fetch(`${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/`),
    listFiles(),
  ]);

  const ollamaOk = ollamaRes.status === "fulfilled" && ollamaRes.value.ok;
  const fileCount = filesRes.status === "fulfilled" ? filesRes.value.length : 0;

  await sendMessage(
    chatId,
    `<b>LocalMind Status</b>\n\n` +
    `🤖 Ollama: ${ollamaOk ? "✅ Online" : "❌ Offline"}\n` +
    `📁 Vault files: ${fileCount}\n` +
    `🕐 Server time: ${new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`
  );
}

// ── Core message processor ────────────────────────────────────────────────────

async function processMessage(chatId: number, userText: string): Promise<void> {
  await sendTypingAction(chatId);

  const [sessionId, storedHistory] = await Promise.all([
    getOrCreateSession(chatId),
    loadChatHistory(chatId),
  ]);

  const historyMessages: UIMessage[] = storedHistory.map((m) => ({
    id: crypto.randomUUID(),
    role: m.role,
    parts: [{ type: "text" as const, text: m.content }],
  }));

  const userMessage: UIMessage = {
    id: crypto.randomUUID(),
    role: "user",
    parts: [{ type: "text", text: userText }],
  };
  const allMessages: UIMessage[] = [...historyMessages, userMessage];

  let memoryCtx;
  try {
    memoryCtx = await recallFast();
  } catch {
    memoryCtx = {
      userIdentity: null, profile: null,
      relevantMemories: [], relevantEntities: [],
      recentHistory: [], sessionSummaries: [], styleNote: null,
    };
  }

  const systemPrompt = buildSystemPrompt(memoryCtx);
  const modelMessages = await convertToModelMessages(allMessages);

  // Only load Notion MCP tools when the user explicitly mentions Notion
  const notionTools = shouldUseNotionTools(userText) ? await getNotionTools() : {};

  const typingInterval = setInterval(() => {
    sendTypingAction(chatId).catch(() => {});
  }, 4_500);

  let responseText = "";
  try {
    const result = streamText({
      model: chatModel,
      system: systemPrompt,
      messages: modelMessages,
      tools: { ...allTools, ...notionTools },
      stopWhen: stepCountIs(5),
      temperature: 0.7,
      onFinish: async ({ text }) => {
        try { await remember(sessionId, userText, text); } catch {}
      },
    });
    responseText = (await result.text).trim();
  } finally {
    clearInterval(typingInterval);
  }

  if (!responseText) {
    await sendMessage(chatId, "I couldn't generate a response. Is Ollama running?");
    return;
  }

  await sendMessage(chatId, toTelegramHtml(responseText));

  const updatedHistory: StoredMessage[] = [
    ...storedHistory,
    { role: "user", content: userText },
    { role: "assistant", content: responseText },
  ];
  await saveChatHistory(chatId, updatedHistory);
}

export { createSession };
