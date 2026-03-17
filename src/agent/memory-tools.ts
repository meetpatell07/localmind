/**
 * Memory & action tools — passed to streamText() so the LLM can read and write
 * memory, update the user's profile, and create tasks on demand.
 *
 * The model decides when to call these based on conversation context.
 * No hard-coded keyword matching — pure AI-driven tool use.
 */

import { tool } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userProfile, tasks } from "@/db/schema";
import { searchSimilar, embedAndStore } from "@/memory/semantic";
import { hot, HOT_KEY } from "@/memory/hot";

// ── Schemas (named so execute functions can reference z.infer) ─────────────────

const updateProfileSchema = z.object({
  field: z.enum([
    "displayName", "email", "phone", "address",
    "linkedin", "portfolioWeb", "instagram", "xHandle", "facebook",
  ]),
  value: z.string().min(1).describe("The new value to save"),
});

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
});

const getMyProfileSchema = z.object({});

// ── Types ─────────────────────────────────────────────────────────────────────

type ProfileFieldKey = z.infer<typeof updateProfileSchema>["field"];
type ProfileInsert   = typeof userProfile.$inferInsert;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProfilePatch(field: ProfileFieldKey, value: string): Partial<ProfileInsert> & { updatedAt: Date } {
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

// ── Tools ─────────────────────────────────────────────────────────────────────

export const memoryTools = {

  update_profile: tool({
    description: `
Update one of the user's personal profile fields in the database.

Call this tool IMMEDIATELY — without asking for confirmation — whenever the user
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

Examples:
- "my Instagram is @meetpatel"   → instagram, @meetpatel
- "here's my LinkedIn: ..."      → linkedin, <url>
- "my portfolio is meet.dev"     → portfolioWeb, meet.dev
- "call me Meet"                 → displayName, Meet
- "phone: +1 555 000 0000"       → phone, +1 555 000 0000
`.trim(),
    inputSchema: updateProfileSchema,
    execute: async (args: z.infer<typeof updateProfileSchema>) => {
      const { field, value } = args;
      try {
        await upsertProfileField(field, value);
        return {
          success: true,
          message: `Saved your ${FIELD_LABELS[field]}: ${value}`,
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  }),

  save_memory: tool({
    description: `
Save an important fact to long-term memory so you remember it in future conversations.

Call this when the user:
- Explicitly asks you to remember: "remember that...", "keep in mind...", "note that...", "don't forget..."
- Shares important context about their life, preferences, goals, work, or relationships
- Corrects or clarifies something you got wrong

Do NOT use this for profile fields (name, email, phone, social handles, website,
address) — use update_profile for those.

Examples:
- "remember I prefer dark mode" → "User prefers dark mode"
- "I'm launching my startup in April" → "User is launching their startup in April"
- "my manager expects reports every Monday" → "User's manager expects weekly reports on Mondays"
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
Search long-term memory for information relevant to a topic.

Call this when:
- The user asks about something from a past conversation ("what did we discuss about X?",
  "do you remember when...", "what do you know about my project Y?")
- You need context that isn't in the current conversation
- You're unsure whether you've discussed something before

Be specific in your query. If results are empty, say so honestly.
`.trim(),
    inputSchema: recallMemoriesSchema,
    execute: async (args: z.infer<typeof recallMemoriesSchema>) => {
      const { query } = args;
      try {
        const results = await searchSimilar(query, 5);
        if (results.length === 0) {
          return { found: false, memories: [], message: "No relevant memories found." };
        }
        return { found: true, memories: results };
      } catch {
        return { found: false, memories: [], message: "Memory search temporarily unavailable." };
      }
    },
  }),

  create_task: tool({
    description: `
Create a new task in the Planner.

Call this when the user:
- Asks to be reminded: "remind me to...", "don't let me forget to..."
- Creates a task explicitly: "add to my todo...", "create a task for..."
- Has a clear actionable deadline: "I need to do X by Friday"
- Wants to follow up: "follow up on X next week"

Priority: urgent/asap/critical → high | normal → medium | someday/whenever → low
Due date: parse relative dates ("tomorrow", "next Monday") and convert to ISO 8601.
`.trim(),
    inputSchema: createTaskSchema,
    execute: async (args: z.infer<typeof createTaskSchema>) => {
      const { title, description, priority, dueDate } = args;
      try {
        const [created] = await db
          .insert(tasks)
          .values({
            title,
            description: description ?? null,
            priority,
            status: "todo",
            dueDate: dueDate ? new Date(dueDate) : null,
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
  }),

  get_my_profile: tool({
    description: `
Retrieve the user's full profile from the database.

Call this when:
- The user asks what profile info you have ("what's my LinkedIn?", "what do you have on me?")
- You want to confirm a current value before answering a profile question
- The user asks to see their profile or contact info
`.trim(),
    inputSchema: getMyProfileSchema,
    execute: async (_args: z.infer<typeof getMyProfileSchema>) => {
      try {
        const rows = await db.select().from(userProfile).limit(1);
        if (!rows[0]) {
          return { profile: null, message: "No profile saved yet. Go to Settings → Profile to add your info." };
        }
        const p = rows[0];
        const filled: Record<string, string> = {};
        if (p.displayName)  filled.name          = p.displayName;
        if (p.email)        filled.email          = p.email;
        if (p.phone)        filled.phone          = p.phone;
        if (p.address)      filled.address        = p.address;
        if (p.linkedin)     filled.linkedin       = p.linkedin;
        if (p.portfolioWeb) filled.portfolio      = p.portfolioWeb;
        if (p.instagram)    filled.instagram      = p.instagram;
        if (p.xHandle)      filled["x/twitter"]   = p.xHandle;
        if (p.facebook)     filled.facebook       = p.facebook;
        return { profile: filled };
      } catch (err) {
        return { profile: null, error: String(err) };
      }
    },
  }),
};
