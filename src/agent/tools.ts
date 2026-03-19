/**
 * Unified tool registry — all AI-callable tools in one place.
 *
 * Exports:
 *   coreTools   — memory, profile, task, knowledge graph (main chat route)
 *   emailTools  — Gmail + create_task (email chat route)
 *   allTools    — everything combined (future unified agent)
 */

import { tool } from "ai";
import { z } from "zod";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import path from "path";
import fs from "fs/promises";
import { db } from "@/db";
import { userProfile, tasks } from "@/db/schema";
import { searchSimilar, embedAndStore } from "@/memory/semantic";
import { hot, HOT_KEY, HOT_TTL } from "@/memory/hot";
import { getEntityContext, processExtractedEntities } from "@/memory/entity";
import { extractEntitiesFromConversation } from "@/agent/extract";
import { getAuthenticatedClient } from "@/connectors/google-auth";
import { listDriveFiles, searchDriveFiles, getDriveFileContent } from "@/connectors/google-drive";
import { ensureVaultDir, indexFile, getVaultPath, updateFileAnalysis } from "@/vault/indexer";
import { analyzeFile } from "@/vault/analyzer";

// ── Helpers ───────────────────────────────────────────────────────────────────

type ProfileFieldKey = z.infer<typeof updateProfileSchema>["field"];
type ProfileInsert = typeof userProfile.$inferInsert;

const updateProfileSchema = z.object({
  field: z.enum([
    "displayName", "email", "phone", "address",
    "linkedin", "portfolioWeb", "instagram", "xHandle", "facebook",
  ]),
  value: z.string().min(1).describe("The new value to save"),
});

function makeProfilePatch(
  field: ProfileFieldKey,
  value: string
): Partial<ProfileInsert> & { updatedAt: Date } {
  const base = { updatedAt: new Date() };
  switch (field) {
    case "displayName":  return { ...base, displayName:  value };
    case "email":        return { ...base, email:        value };
    case "phone":        return { ...base, phone:        value };
    case "address":      return { ...base, address:      value };
    case "linkedin":     return { ...base, linkedin:     value };
    case "portfolioWeb": return { ...base, portfolioWeb: value };
    case "instagram":    return { ...base, instagram:    value };
    case "xHandle":      return { ...base, xHandle:      value };
    case "facebook":     return { ...base, facebook:     value };
  }
}

const FIELD_LABELS: Record<ProfileFieldKey, string> = {
  displayName:  "name",
  email:        "email",
  phone:        "phone number",
  address:      "address",
  linkedin:     "LinkedIn",
  portfolioWeb: "portfolio / website",
  instagram:    "Instagram",
  xHandle:      "X (Twitter)",
  facebook:     "Facebook",
};

async function upsertProfileField(field: ProfileFieldKey, value: string): Promise<void> {
  const patch = makeProfilePatch(field, value);
  const existing = await db.select({ id: userProfile.id }).from(userProfile).limit(1);
  if (existing[0]) {
    await db.update(userProfile).set(patch).where(eq(userProfile.id, existing[0].id));
  } else {
    await db.insert(userProfile).values(patch);
  }
  hot.delete(HOT_KEY.userIdentity());
}

/** Deterministic 16-char hex hash of a query string for recall caching. */
function hashQuery(q: string): string {
  return createHash("sha256").update(q.toLowerCase().trim()).digest("hex").slice(0, 16);
}

// ── Gmail helpers ─────────────────────────────────────────────────────────────

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined, depth = 0): string {
  if (!payload || depth > 5) return "";
  if (payload.body?.data) {
    const text = decodeBase64(payload.body.data);
    return payload.mimeType === "text/html"
      ? text.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
      : text;
  }
  if (!payload.parts) return "";
  for (const part of payload.parts) {
    if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64(part.body.data);
  }
  for (const part of payload.parts) {
    if (part.mimeType?.startsWith("multipart/")) {
      const nested = extractBody(part, depth + 1);
      if (nested) return nested;
    }
  }
  for (const part of payload.parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      return decodeBase64(part.body.data).replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
    }
  }
  return "";
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const saveMemorySchema = z.object({
  content: z.string().min(5).describe("The fact to remember — a clear, self-contained statement"),
  category: z
    .enum(["preference", "fact", "goal", "relationship", "context", "note"])
    .default("fact"),
});

const recallMemoriesSchema = z.object({
  query: z.string().min(3).describe("Specific search query — what to look for in memory"),
});

const createTaskSchema = z.object({
  title:       z.string().max(500).describe("Clear, actionable task title"),
  description: z.string().optional().describe("Optional context or details"),
  priority:    z.enum(["low", "medium", "high"]).default("medium"),
  dueDate:     z.string().optional().describe("ISO 8601 datetime if a deadline was mentioned"),
  tags:        z.array(z.string()).optional().describe("Optional tags (e.g. ['email', 'project-x'])"),
});

const queryKGSchema = z.object({
  query: z.string().min(2).describe("Entity name or topic to look up in the knowledge graph"),
  entityType: z
    .enum(["person", "project", "technology", "preference", "concept", "organization", "event", "other"])
    .optional()
    .describe("Optional: filter results to this entity type"),
});

// ── Core tools ─────────────────────────────────────────────────────────────────

export const coreTools = {

  update_profile: tool({
    description: `
Update one of Meet's personal profile fields in the database.

Call this IMMEDIATELY — without asking for confirmation — whenever Meet
provides, mentions, or corrects any of the following personal details:

| What they say                              | field        |
|--------------------------------------------|--------------|
| name / what to call them                   | displayName  |
| email address                              | email        |
| phone / mobile number                      | phone        |
| address, city, or country                  | address      |
| LinkedIn profile URL                       | linkedin     |
| portfolio, personal website, any URL       | portfolioWeb |
| Instagram username or @handle              | instagram    |
| X / Twitter @handle                        | xHandle      |
| Facebook profile URL or name               | facebook     |
`.trim(),
    inputSchema: updateProfileSchema,
    execute: async (args: z.infer<typeof updateProfileSchema>) => {
      const { field, value } = args;
      try {
        await upsertProfileField(field, value);
        return { success: true, message: `Saved your ${FIELD_LABELS[field]}: ${value}` };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  }),

  save_memory: tool({
    description: `
Save an important fact to long-term memory so you remember it in future conversations.

Call this when Meet:
- Explicitly asks you to remember: "remember that...", "keep in mind...", "note that..."
- Shares important context about their life, preferences, goals, work, or relationships
- Corrects or clarifies something you got wrong

Do NOT use this for profile fields (name, email, phone, social handles, website,
address) — use update_profile for those.
`.trim(),
    inputSchema: saveMemorySchema,
    execute: async (args: z.infer<typeof saveMemorySchema>) => {
      const { content, category } = args;
      try {
        await embedAndStore(content, "memory", undefined, {
          category,
          savedAt: new Date().toISOString(),
          source: "explicit",
        });
        return { success: true, saved: content };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  }),

  recall_memories: tool({
    description: `
Search long-term semantic memory for information relevant to a topic.

Call this when:
- Meet asks about something from a past conversation
- You need context that isn't in the current conversation window
- You're unsure whether something was discussed before

Be specific in your query. Results come from embedded conversation history.
For structured entity facts (projects, people, tech), prefer query_knowledge_graph.
`.trim(),
    inputSchema: recallMemoriesSchema,
    execute: async (args: z.infer<typeof recallMemoriesSchema>) => {
      const { query } = args;
      try {
        // ── Hot cache check — skip pgvector on repeated queries ──────────────
        const hash     = hashQuery(query);
        const cacheKey = HOT_KEY.recallQuery(hash);
        const cached   = hot.get<string[]>(cacheKey);

        if (cached) {
          return { found: cached.length > 0, memories: cached, fromCache: true };
        }

        const results = await searchSimilar(query, 5);

        // Cache even empty results so we don't re-embed the same query
        hot.set(cacheKey, results, HOT_TTL.RECALL_QUERY);

        if (results.length === 0) {
          return { found: false, memories: [], message: "No relevant memories found." };
        }
        return { found: true, memories: results };
      } catch {
        return { found: false, memories: [], message: "Memory search temporarily unavailable." };
      }
    },
  }),

  query_knowledge_graph: tool({
    description: `
Query the knowledge graph (L3) to retrieve structured facts about a person, project,
technology, or any entity Meet has mentioned.

Call this when:
- Meet asks "what do I know about X?" or "what's my connection to Y?"
- You need structured facts (relationships, attributes) about a named entity
- recall_memories returns nothing but the entity likely exists in the graph
- You want to find how entities are connected to each other

Examples:
- "what project is Meet working on?" → query "Meet"
- "what tech stack does LocalMind use?" → query "LocalMind"
- "who is Sarah?" → query "Sarah", entityType: "person"
`.trim(),
    inputSchema: queryKGSchema,
    execute: async (args: z.infer<typeof queryKGSchema>) => {
      const { query, entityType } = args;
      try {
        const results = await getEntityContext([query]);
        const filtered = entityType
          ? results.filter((e) => (e as { type: string }).type === entityType)
          : results;

        if (filtered.length === 0) {
          // Semantic fallback — search memory chunks for the topic
          const semantic = await searchSimilar(query, 3);
          if (semantic.length === 0) {
            return { found: false, entities: [], message: `Nothing found about "${query}" in the knowledge graph.` };
          }
          return { found: true, entities: [], semanticContext: semantic };
        }

        return { found: true, entities: filtered };
      } catch (err) {
        return { found: false, entities: [], error: String(err) };
      }
    },
  }),

  create_task: tool({
    description: `
Create a new task in the Planner.

Call this when Meet:
- Asks to be reminded: "remind me to...", "don't let me forget to..."
- Creates a task explicitly: "add to my todo...", "create a task for..."
- Has a clear actionable deadline: "I need to do X by Friday"
- Wants to follow up: "follow up on X next week"

Priority: urgent/asap/critical → high | normal → medium | someday/whenever → low
Due date: parse relative dates ("tomorrow", "next Monday") and convert to ISO 8601.
`.trim(),
    inputSchema: createTaskSchema,
    execute: async (args: z.infer<typeof createTaskSchema>) => {
      const { title, description, priority, dueDate, tags } = args;
      try {
        const [created] = await db
          .insert(tasks)
          .values({
            title,
            description: description ?? null,
            priority,
            status: "todo",
            dueDate: dueDate ? new Date(dueDate) : null,
            tags: tags ?? [],
          })
          .returning({ id: tasks.id, title: tasks.title });

        // ── Shadow extraction: link task to knowledge graph ──────────────────
        // Extract entities from the task description and wire them into L3.
        // Fire-and-forget — never blocks the tool response.
        const taskText = [title, description].filter(Boolean).join(". ");
        extractEntitiesFromConversation(taskText, "")
          .then((extracted) => {
            if (extracted) return processExtractedEntities(extracted);
          })
          .catch(() => {});

        return {
          success: true,
          task: { id: created?.id, title: created?.title },
          message: `Task created: "${title}"`,
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  }),

  get_my_profile: tool({
    description: `
Retrieve Meet's full profile from the database.

Call this when:
- Meet asks what profile info you have ("what's my LinkedIn?", "what do you have on me?")
- You want to confirm a current value before answering a profile question
`.trim(),
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const rows = await db.select().from(userProfile).limit(1);
        if (!rows[0]) {
          return { profile: null, message: "No profile saved yet. Go to Settings → Profile to add your info." };
        }
        const p = rows[0];
        const filled: Record<string, string> = {};
        if (p.displayName)  filled.name           = p.displayName;
        if (p.email)        filled.email           = p.email;
        if (p.phone)        filled.phone           = p.phone;
        if (p.address)      filled.address         = p.address;
        if (p.linkedin)     filled.linkedin        = p.linkedin;
        if (p.portfolioWeb) filled.portfolio       = p.portfolioWeb;
        if (p.instagram)    filled.instagram       = p.instagram;
        if (p.xHandle)      filled["x/twitter"]   = p.xHandle;
        if (p.facebook)     filled.facebook        = p.facebook;
        return { profile: filled };
      } catch (err) {
        return { profile: null, error: String(err) };
      }
    },
  }),
};

// ── MIME email builder (draft / reply) ────────────────────────────────────────
function buildMimeMessage({
  to, subject, body, inReplyTo, references,
}: {
  to: string; subject: string; body: string;
  inReplyTo?: string; references?: string;
}): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (inReplyTo)  headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);
  const raw = [...headers, "", body].join("\r\n");
  return Buffer.from(raw).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ── Email tools ────────────────────────────────────────────────────────────────

export const emailTools = {

  list_emails: tool({
    description:
      "List recent emails from Gmail inbox. Use when the user asks to see their emails, check their inbox, or find recent messages.",
    inputSchema: z.object({
      maxResults: z.number().min(1).max(20).default(10).describe("Number of emails to fetch"),
      labelIds: z.array(z.string()).default(["INBOX"]).describe("Gmail label IDs — default INBOX. Use UNREAD for unread-only."),
    }),
    execute: async (args: { maxResults: number; labelIds: string[] }) => {
      const auth = await getAuthenticatedClient();
      if (!auth) return { error: "Gmail not connected. Ask the user to connect in Settings." };
      try {
        const gmail = google.gmail({ version: "v1", auth });
        const listRes = await gmail.users.messages.list({ userId: "me", maxResults: args.maxResults, labelIds: args.labelIds });
        if (!listRes.data.messages?.length) return { emails: [], total: 0 };
        const emails = await Promise.all(
          listRes.data.messages.map(async (msg) => {
            const detail = await gmail.users.messages.get({
              userId: "me", id: msg.id!, format: "metadata",
              metadataHeaders: ["From", "To", "Subject", "Date"],
            });
            const h = detail.data.payload?.headers;
            return {
              id: msg.id!,
              from:     getHeader(h, "From"),
              to:       getHeader(h, "To"),
              subject:  getHeader(h, "Subject"),
              date:     getHeader(h, "Date"),
              snippet:  detail.data.snippet ?? "",
              isUnread: detail.data.labelIds?.includes("UNREAD") ?? false,
            };
          })
        );
        return { emails, total: emails.length };
      } catch (err) {
        return { error: `Gmail API error: ${String(err)}` };
      }
    },
  }),

  search_emails: tool({
    description:
      "Search Gmail for emails matching a query. Supports Gmail search syntax: from:, to:, subject:, after:, before:, is:unread, has:attachment, etc.",
    inputSchema: z.object({
      query:      z.string().describe("Gmail search query, e.g. 'from:sarah deadline' or 'subject:invoice is:unread'"),
      maxResults: z.number().min(1).max(20).default(10),
    }),
    execute: async (args: { query: string; maxResults: number }) => {
      const auth = await getAuthenticatedClient();
      if (!auth) return { error: "Gmail not connected." };
      try {
        const gmail = google.gmail({ version: "v1", auth });
        const listRes = await gmail.users.messages.list({ userId: "me", q: args.query, maxResults: args.maxResults });
        if (!listRes.data.messages?.length) return { emails: [], query: args.query, total: 0 };
        const emails = await Promise.all(
          listRes.data.messages.map(async (msg) => {
            const detail = await gmail.users.messages.get({
              userId: "me", id: msg.id!, format: "metadata",
              metadataHeaders: ["From", "To", "Subject", "Date"],
            });
            const h = detail.data.payload?.headers;
            return {
              id: msg.id!,
              from:     getHeader(h, "From"),
              subject:  getHeader(h, "Subject"),
              date:     getHeader(h, "Date"),
              snippet:  detail.data.snippet ?? "",
              isUnread: detail.data.labelIds?.includes("UNREAD") ?? false,
            };
          })
        );
        return { emails, query: args.query, total: emails.length };
      } catch (err) {
        return { error: `Gmail API error: ${String(err)}` };
      }
    },
  }),

  get_email: tool({
    description:
      "Fetch the full content of a specific email by ID. Use when the user wants to read a specific email or you need the full body.",
    inputSchema: z.object({
      emailId: z.string().describe("Gmail message ID from list_emails or search_emails"),
    }),
    execute: async (args: { emailId: string }) => {
      const auth = await getAuthenticatedClient();
      if (!auth) return { error: "Gmail not connected." };
      try {
        const gmail = google.gmail({ version: "v1", auth });
        const msg = await gmail.users.messages.get({ userId: "me", id: args.emailId, format: "full" });
        const h    = msg.data.payload?.headers;
        return {
          id:       args.emailId,
          from:     getHeader(h, "From"),
          to:       getHeader(h, "To"),
          subject:  getHeader(h, "Subject"),
          date:     getHeader(h, "Date"),
          body:     extractBody(msg.data.payload).slice(0, 3000),
          isUnread: msg.data.labelIds?.includes("UNREAD") ?? false,
          labels:   msg.data.labelIds ?? [],
        };
      } catch (err) {
        return { error: `Could not fetch email: ${String(err)}` };
      }
    },
  }),

  // Shares the same create_task logic + shadow extraction
  create_task: coreTools.create_task,

  // ── Calendar availability ────────────────────────────────────────────────────
  check_calendar_availability: tool({
    description: `
Check Google Calendar for upcoming events and free time windows.

Call this when:
- Drafting a reply that involves scheduling, meetings, or deadlines
- The user asks "am I free on X?", "what's on my calendar?", "when can I meet?"
- You need to reference real availability before suggesting times in an email reply

Returns a list of events for the next N days and derived free windows (9am–6pm).
`.trim(),
    inputSchema: z.object({
      days:     z.number().min(1).max(14).default(7).describe("How many days ahead to check (default 7)"),
      timezone: z.string().default("UTC").describe("IANA timezone for display (e.g. 'America/New_York')"),
    }),
    execute: async (args: { days: number; timezone: string }) => {
      const auth = await getAuthenticatedClient();
      if (!auth) return { error: "Google not connected. Connect in Settings → Connections." };

      try {
        const calendar = google.calendar({ version: "v3", auth });

        const now      = new Date();
        const rangeEnd = new Date(now.getTime() + args.days * 86_400_000);

        const eventsRes = await calendar.events.list({
          calendarId:   "primary",
          timeMin:      now.toISOString(),
          timeMax:      rangeEnd.toISOString(),
          singleEvents: true,
          orderBy:      "startTime",
          maxResults:   30,
        });

        const events = (eventsRes.data.items ?? []).map((ev) => ({
          title:    ev.summary ?? "(no title)",
          start:    ev.start?.dateTime ?? ev.start?.date ?? "",
          end:      ev.end?.dateTime   ?? ev.end?.date   ?? "",
          allDay:   !ev.start?.dateTime,
          location: ev.location ?? null,
        }));

        // Derive simple free-window summary per day (9am–6pm, non-all-day events)
        const busyByDay = new Map<string, Array<{ start: Date; end: Date }>>();
        for (const ev of events) {
          if (ev.allDay || !ev.start || !ev.end) continue;
          const day = new Date(ev.start).toDateString();
          const list = busyByDay.get(day) ?? [];
          list.push({ start: new Date(ev.start), end: new Date(ev.end) });
          busyByDay.set(day, list);
        }

        const freeWindows: string[] = [];
        for (let i = 0; i < args.days; i++) {
          const day = new Date(now);
          day.setDate(now.getDate() + i);
          day.setHours(9, 0, 0, 0);
          const dayLabel = day.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
          const busySlots = busyByDay.get(day.toDateString()) ?? [];

          if (busySlots.length === 0) {
            freeWindows.push(`${dayLabel}: fully free 9am–6pm`);
          } else {
            // Compute gaps between busy slots within 9am–6pm
            const sorted = [...busySlots].sort((a, b) => a.start.getTime() - b.start.getTime());
            const gaps: string[] = [];
            let cursor = new Date(day);

            for (const slot of sorted) {
              const slotStart = slot.start < day ? day : slot.start;
              const gap = slotStart.getTime() - cursor.getTime();
              if (gap >= 30 * 60 * 1000) {
                gaps.push(`${cursor.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}–${slotStart.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`);
              }
              if (slot.end > cursor) cursor = slot.end;
            }

            const eod = new Date(day);
            eod.setHours(18, 0, 0, 0);
            if (eod.getTime() - cursor.getTime() >= 30 * 60 * 1000) {
              gaps.push(`${cursor.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}–6:00 PM`);
            }

            freeWindows.push(gaps.length > 0
              ? `${dayLabel}: free ${gaps.join(", ")}`
              : `${dayLabel}: fully booked`
            );
          }
        }

        return {
          events,
          freeWindows,
          range: `Next ${args.days} days`,
          timezone: args.timezone,
        };
      } catch (err) {
        return { error: `Calendar error: ${String(err)}` };
      }
    },
  }),

  // ── Create Gmail draft reply ─────────────────────────────────────────────────
  create_draft_reply: tool({
    description: `
Create a Gmail draft reply to a specific email. The draft is saved in Gmail Drafts
so the user can review and send it themselves.

Call this AFTER you have:
1. Read the email content (via get_email)
2. Checked availability if scheduling is involved (via check_calendar_availability)
3. Composed the full reply body

The tool saves the draft and returns a preview so the user can confirm.
`.trim(),
    inputSchema: z.object({
      emailId:   z.string().describe("Gmail message ID of the email to reply to"),
      replyBody: z.string().min(10).describe("The complete reply text — write the full email body here"),
    }),
    execute: async (args: { emailId: string; replyBody: string }) => {
      const auth = await getAuthenticatedClient();
      if (!auth) return { error: "Gmail not connected." };

      try {
        const gmail = google.gmail({ version: "v1", auth });

        // Fetch original email headers
        const original = await gmail.users.messages.get({
          userId: "me",
          id:     args.emailId,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Message-ID", "References"],
        });

        const h         = original.data.payload?.headers ?? [];
        const from      = h.find((x) => x.name?.toLowerCase() === "from")?.value      ?? "";
        const subject   = h.find((x) => x.name?.toLowerCase() === "subject")?.value   ?? "";
        const messageId = h.find((x) => x.name?.toLowerCase() === "message-id")?.value ?? "";
        const refs      = h.find((x) => x.name?.toLowerCase() === "references")?.value ?? "";
        const threadId  = original.data.threadId ?? undefined;

        const replySubject = subject.toLowerCase().startsWith("re:")
          ? subject
          : `Re: ${subject}`;

        const raw = buildMimeMessage({
          to:         from,
          subject:    replySubject,
          body:       args.replyBody,
          inReplyTo:  messageId,
          references: [refs, messageId].filter(Boolean).join(" "),
        });

        const draft = await gmail.users.drafts.create({
          userId: "me",
          requestBody: {
            message: { raw, threadId },
          },
        });

        const preview = args.replyBody.slice(0, 300) + (args.replyBody.length > 300 ? "…" : "");

        return {
          success:  true,
          draftId:  draft.data.id,
          to:       from,
          subject:  replySubject,
          preview,
          message:  `Draft saved to Gmail. Open Gmail to review and send it.`,
        };
      } catch (err) {
        return { success: false, error: `Could not create draft: ${String(err)}` };
      }
    },
  }),
};

// ── Drive tools ────────────────────────────────────────────────────────────────

export const driveTools = {

  list_drive_files: tool({
    description:
      "List files from Google Drive. Use when the user asks to see their Drive files, find recent documents, or browse their Drive.",
    inputSchema: z.object({
      maxResults: z.number().min(1).max(20).default(10),
      mimeType:   z.string().optional().describe("Filter by MIME type, e.g. 'application/vnd.google-apps.document' for Google Docs"),
      starred:    z.boolean().optional().describe("Only show starred files"),
      query:      z.string().optional().describe("Search query for file names or content"),
    }),
    execute: async (args: { maxResults: number; mimeType?: string; starred?: boolean; query?: string }) => {
      try {
        if (args.query) {
          const result = await searchDriveFiles(args.query, args.maxResults);
          if (result.error) return { error: result.error };
          return { files: result.files, total: result.files.length };
        }
        const result = await listDriveFiles({
          maxResults: args.maxResults,
          mimeType:   args.mimeType,
          starred:    args.starred,
        });
        if (result.error) return { error: result.error };
        return { files: result.files, total: result.files.length };
      } catch (err) {
        return { error: `Drive error: ${String(err)}` };
      }
    },
  }),

  search_drive_files: tool({
    description:
      "Search Google Drive files by content or name. Use Gmail-style queries or plain text.",
    inputSchema: z.object({
      query:      z.string().min(2).describe("Search query — searches file names and content"),
      maxResults: z.number().min(1).max(20).default(10),
    }),
    execute: async (args: { query: string; maxResults: number }) => {
      try {
        const result = await searchDriveFiles(args.query, args.maxResults);
        if (result.error) return { error: result.error };
        return { files: result.files, total: result.files.length, query: args.query };
      } catch (err) {
        return { error: `Drive error: ${String(err)}` };
      }
    },
  }),

  get_drive_file: tool({
    description:
      "Get the content of a specific Google Drive file. Returns text content for Docs/Sheets/text files, metadata only for binary files.",
    inputSchema: z.object({
      fileId: z.string().describe("Google Drive file ID from list_drive_files or search_drive_files"),
    }),
    execute: async (args: { fileId: string }) => {
      try {
        const result = await getDriveFileContent(args.fileId);
        if (result.error) return { error: result.error };
        return result;
      } catch (err) {
        return { error: `Drive error: ${String(err)}` };
      }
    },
  }),
};

// ── Gmail attachment helpers ──────────────────────────────────────────────────

interface AttachmentMeta {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

function findAttachments(part: gmail_v1.Schema$MessagePart | undefined): AttachmentMeta[] {
  if (!part) return [];
  const results: AttachmentMeta[] = [];

  if (part.filename && part.body?.attachmentId) {
    results.push({
      filename:     part.filename,
      mimeType:     part.mimeType ?? "application/octet-stream",
      attachmentId: part.body.attachmentId,
      size:         part.body.size ?? 0,
    });
  }

  if (part.parts) {
    for (const child of part.parts) {
      results.push(...findAttachments(child));
    }
  }

  return results;
}

async function downloadAndVaultAttachment(
  gmail: gmail_v1.Gmail,
  messageId: string,
  att: AttachmentMeta,
  emailSubject: string
): Promise<{ fileName: string; category: string; summary: string } | null> {
  try {
    const res = await gmail.users.messages.attachments.get({
      userId:    "me",
      messageId,
      id:        att.attachmentId,
    });

    const rawB64 = res.data.data;
    if (!rawB64) return null;

    // Gmail uses base64url — convert to standard base64
    const buffer = Buffer.from(rawB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");

    // Save to vault under YYYY/MM/DD structure
    await ensureVaultDir();
    const now = new Date();
    const subDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
    const fullDir = getVaultPath(subDir);
    await fs.mkdir(fullDir, { recursive: true });

    const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueName = `${Date.now()}_${safeName}`;
    const relativePath = path.join(subDir, uniqueName);
    const fullPath = getVaultPath(relativePath);

    await fs.writeFile(fullPath, buffer);

    const record = await indexFile({
      fileName:  att.filename,
      relativePath,
      mimeType:  att.mimeType,
      sizeBytes: buffer.length,
      source:    "email",
      tags:      [emailSubject.slice(0, 50)],
    });

    // Fire-and-forget AI analysis
    analyzeFile({
      fileId:       record.id,
      fileName:     att.filename,
      mimeType:     att.mimeType,
      absolutePath: fullPath,
    })
      .then((analysis) => updateFileAnalysis(record.id, analysis))
      .catch(() => {});

    return {
      fileName: att.filename,
      category: "pending AI analysis",
      summary:  `From email: "${emailSubject}"`,
    };
  } catch {
    return null;
  }
}

// ── save_email_attachments tool ───────────────────────────────────────────────

const saveEmailAttachmentsSchema = z.object({
  emailId: z
    .string()
    .optional()
    .describe("Gmail message ID of a specific email to download attachments from"),
  query: z
    .string()
    .optional()
    .describe(
      "Gmail search query to find emails with attachments, e.g. 'from:john has:attachment', 'subject:invoice has:attachment'. Automatically appends 'has:attachment' if omitted."
    ),
  maxEmails: z
    .number()
    .min(1)
    .max(10)
    .default(3)
    .describe("Max number of emails to process when using a search query"),
});

const vaultAttachmentTool = tool({
  description: `
Download and save all attachments from one or more emails into the local Vault.
The AI will then automatically categorize each file.

Call this when Meet asks to:
- "Save attachments from that email"
- "Download all documents from emails from [person]"
- "Extract files from the invoice emails"
- "Save everything I sent to [name] to my vault"
- "Download and store the attachments from subject: [subject]"

Provide either:
- emailId — for a specific known email
- query   — Gmail search syntax to find matching emails (e.g. "from:sarah has:attachment")
If neither is given, default query to "has:attachment" (last 3 emails with any attachment).
`.trim(),
  inputSchema: saveEmailAttachmentsSchema,
  execute: async (args: z.infer<typeof saveEmailAttachmentsSchema>) => {
    const auth = await getAuthenticatedClient();
    if (!auth) {
      return { success: false, error: "Gmail not connected. Connect in Settings → Connections." };
    }

    try {
      const gmail = google.gmail({ version: "v1", auth });
      const messageIds: string[] = [];

      if (args.emailId) {
        messageIds.push(args.emailId);
      } else {
        const q = args.query
          ? (args.query.includes("has:attachment") ? args.query : `${args.query} has:attachment`)
          : "has:attachment";

        const listRes = await gmail.users.messages.list({
          userId:     "me",
          q,
          maxResults: args.maxEmails,
        });

        if (!listRes.data.messages?.length) {
          return { success: false, message: `No emails found matching: "${q}"` };
        }

        messageIds.push(...listRes.data.messages.map((m) => m.id!));
      }

      const saved: Array<{ emailSubject: string; files: string[] }> = [];
      let totalFiles = 0;

      for (const msgId of messageIds) {
        const msg = await gmail.users.messages.get({ userId: "me", id: msgId, format: "full" });
        const subject = getHeader(msg.data.payload?.headers, "Subject") || "(no subject)";
        const attachments = findAttachments(msg.data.payload ?? undefined);

        if (attachments.length === 0) continue;

        const savedFiles: string[] = [];

        for (const att of attachments) {
          const result = await downloadAndVaultAttachment(gmail, msgId, att, subject);
          if (result) {
            savedFiles.push(att.filename);
            totalFiles++;
          }
        }

        if (savedFiles.length > 0) {
          saved.push({ emailSubject: subject, files: savedFiles });
        }
      }

      if (totalFiles === 0) {
        return { success: false, message: "No downloadable attachments found in the selected emails." };
      }

      return {
        success:    true,
        totalSaved: totalFiles,
        emails:     saved,
        message:    `Saved ${totalFiles} file${totalFiles !== 1 ? "s" : ""} to Vault. AI is now categorizing them in the background.`,
      };
    } catch (err) {
      return { success: false, error: `Gmail error: ${String(err)}` };
    }
  },
});

// ── Full tool set ──────────────────────────────────────────────────────────────
export const allTools = { ...coreTools, ...emailTools, ...driveTools };
