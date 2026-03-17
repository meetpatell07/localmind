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
import { db } from "@/db";
import { userProfile, tasks } from "@/db/schema";
import { searchSimilar, embedAndStore } from "@/memory/semantic";
import { hot, HOT_KEY, HOT_TTL } from "@/memory/hot";
import { getEntityContext, processExtractedEntities } from "@/memory/entity";
import { extractEntitiesFromConversation } from "@/agent/extract";
import { getAuthenticatedClient } from "@/connectors/google-auth";

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
};

// ── Full tool set ──────────────────────────────────────────────────────────────
export const allTools = { ...coreTools, ...emailTools };
