/**
 * Gmail AI SDK tools — passed to streamText() so the LLM can read and search
 * the user's inbox on demand. Also includes a create_task tool so the AI can
 * create Planner tasks directly from email context.
 *
 * Tools run server-side inside the API route handler.
 * All Gmail access uses the authenticated OAuth2 client from google-auth.ts.
 */

import { tool } from "ai";
import { z } from "zod";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { getAuthenticatedClient } from "./google-auth";
import { db } from "@/db";
import { tasks } from "@/db/schema";

// ── Base64url decode ──────────────────────────────────────────────────────────
function decodeBase64(data: string): string {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf-8");
}

// ── Extract readable text from Gmail message payload ──────────────────────────
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined, depth = 0): string {
  if (!payload || depth > 5) return "";

  // Direct body
  if (payload.body?.data) {
    const text = decodeBase64(payload.body.data);
    if (payload.mimeType === "text/html") {
      return text.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
    }
    return text;
  }

  if (!payload.parts) return "";

  // Prefer text/plain
  for (const part of payload.parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64(part.body.data);
    }
  }

  // Recurse into multipart
  for (const part of payload.parts) {
    if (part.mimeType?.startsWith("multipart/")) {
      const nested = extractBody(part, depth + 1);
      if (nested) return nested;
    }
  }

  // Fallback: strip HTML
  for (const part of payload.parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      return decodeBase64(part.body.data).replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
    }
  }

  return "";
}

// ── Header helper ─────────────────────────────────────────────────────────────
function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// ── Tool: list recent emails ──────────────────────────────────────────────────
export const listEmailsTool = tool({
  description:
    "List recent emails from Gmail inbox. Use this when the user asks to see their emails, check their inbox, or find recent messages.",
  parameters: z.object({
    maxResults: z
      .number()
      .min(1)
      .max(20)
      .default(10)
      .describe("Number of emails to fetch"),
    labelIds: z
      .array(z.string())
      .default(["INBOX"])
      .describe("Gmail label IDs — default INBOX. Use UNREAD for unread-only."),
  }),
  execute: async ({ maxResults, labelIds }) => {
    const auth = await getAuthenticatedClient();
    if (!auth) return { error: "Gmail not connected. Ask the user to connect in Settings." };

    try {
      const gmail = google.gmail({ version: "v1", auth });

      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults,
        labelIds,
      });

      if (!listRes.data.messages?.length) return { emails: [], total: 0 };

      const emails = await Promise.all(
        listRes.data.messages.map(async (msg) => {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });

          const h = detail.data.payload?.headers;
          return {
            id: msg.id!,
            from: getHeader(h, "From"),
            to: getHeader(h, "To"),
            subject: getHeader(h, "Subject"),
            date: getHeader(h, "Date"),
            snippet: detail.data.snippet ?? "",
            isUnread: detail.data.labelIds?.includes("UNREAD") ?? false,
          };
        })
      );

      return { emails, total: emails.length };
    } catch (err) {
      return { error: `Gmail API error: ${String(err)}` };
    }
  },
});

// ── Tool: search emails ───────────────────────────────────────────────────────
export const searchEmailsTool = tool({
  description:
    "Search Gmail for emails matching a query. Supports Gmail search syntax: from:, to:, subject:, after:, before:, is:unread, has:attachment, etc.",
  parameters: z.object({
    query: z.string().describe("Gmail search query. Example: 'from:sarah deadline' or 'subject:invoice is:unread'"),
    maxResults: z.number().min(1).max(20).default(10),
  }),
  execute: async ({ query, maxResults }) => {
    const auth = await getAuthenticatedClient();
    if (!auth) return { error: "Gmail not connected." };

    try {
      const gmail = google.gmail({ version: "v1", auth });

      const listRes = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });

      if (!listRes.data.messages?.length) return { emails: [], query, total: 0 };

      const emails = await Promise.all(
        listRes.data.messages.map(async (msg) => {
          const detail = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });
          const h = detail.data.payload?.headers;
          return {
            id: msg.id!,
            from: getHeader(h, "From"),
            subject: getHeader(h, "Subject"),
            date: getHeader(h, "Date"),
            snippet: detail.data.snippet ?? "",
            isUnread: detail.data.labelIds?.includes("UNREAD") ?? false,
          };
        })
      );

      return { emails, query, total: emails.length };
    } catch (err) {
      return { error: `Gmail API error: ${String(err)}` };
    }
  },
});

// ── Tool: get full email content ──────────────────────────────────────────────
export const getEmailTool = tool({
  description:
    "Fetch the full content of a specific email by ID. Use this when the user wants to read a specific email or when you need the full body to answer a question.",
  parameters: z.object({
    emailId: z.string().describe("Gmail message ID from list_emails or search_emails"),
  }),
  execute: async ({ emailId }) => {
    const auth = await getAuthenticatedClient();
    if (!auth) return { error: "Gmail not connected." };

    try {
      const gmail = google.gmail({ version: "v1", auth });

      const msg = await gmail.users.messages.get({
        userId: "me",
        id: emailId,
        format: "full",
      });

      const h = msg.data.payload?.headers;
      const body = extractBody(msg.data.payload);

      return {
        id: emailId,
        from: getHeader(h, "From"),
        to: getHeader(h, "To"),
        subject: getHeader(h, "Subject"),
        date: getHeader(h, "Date"),
        body: body.slice(0, 3000), // cap at 3k chars to stay within context
        isUnread: msg.data.labelIds?.includes("UNREAD") ?? false,
        labels: msg.data.labelIds ?? [],
      };
    } catch (err) {
      return { error: `Could not fetch email: ${String(err)}` };
    }
  },
});

// ── Tool: create task from email context ──────────────────────────────────────
export const createTaskTool = tool({
  description:
    "Create a task in the Planner based on an email. Use this when the user asks to 'create a task', 'add to planner', 'remind me about this', or similar.",
  parameters: z.object({
    title: z.string().max(500).describe("Task title — clear and actionable"),
    description: z
      .string()
      .optional()
      .describe("Optional details — include email context, sender name, key info"),
    priority: z
      .enum(["low", "medium", "high"])
      .default("medium")
      .describe("Task priority based on email urgency"),
    dueDate: z
      .string()
      .optional()
      .describe("ISO 8601 due date (e.g. 2026-03-20T09:00:00Z) if mentioned in email"),
  }),
  execute: async ({ title, description, priority, dueDate }) => {
    try {
      const [created] = await db
        .insert(tasks)
        .values({
          title,
          description: description ?? null,
          priority,
          status: "todo",
          dueDate: dueDate ? new Date(dueDate) : null,
          tags: ["email"],
        })
        .returning({ id: tasks.id, title: tasks.title });

      return {
        success: true,
        task: { id: created?.id, title: created?.title },
        message: `Task created: "${title}"`,
      };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});

// ── All email tools (passed to streamText) ────────────────────────────────────
export const emailTools = {
  list_emails:   listEmailsTool,
  search_emails: searchEmailsTool,
  get_email:     getEmailTool,
  create_task:   createTaskTool,
};
