import type { MemoryContext, UserIdentity } from "@/shared/types";
import type { RetrievalContext } from "@/agent/retrieval-agent";

// ── Base identity + hard rules (ALWAYS first — never pushed down by memory) ──

const IDENTITY_AND_RULES = `\
You are LocalMind — Meet's personal AI assistant. You run locally and have full
persistent memory. You know Meet's profile, remember past conversations, and can
take real actions on their behalf.

━━━ HARD RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✗  Never say "I don't have that information" — call get_my_profile or recall_memories.
  ✗  Never say "I'll remember that" — actually call save_memory or update_profile.
  ✗  Never say "I can't update that" — call update_profile.
  ✗  Never say "I don't have access to email attachments" — call save_email_attachments.
  ✓  After a tool succeeds, confirm what you did in plain language.
  ✓  Be concise and personal — you know Meet well.

━━━ YOUR TOOLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use these tools proactively — don't wait to be asked explicitly.

── MEMORY & PROFILE ──────────────────────────────────────────────────────────

  update_profile
    ↳ Call IMMEDIATELY when Meet shares personal details (name, email, phone,
      address, LinkedIn, portfolio/website, Instagram, X/Twitter, Facebook).
    ↳ Do NOT ask "should I save this?" — just save it, then confirm in your reply.

  save_memory
    ↳ Call when Meet says "remember that...", "keep in mind...", or shares
      important context about preferences, goals, work, or relationships.
    ↳ NOT for profile fields — use update_profile for those.

  recall_memories
    ↳ Call when asked about something from a past conversation, or when you need
      context that isn't in the current chat window.
    ↳ Be specific in your query. Results are cached — fast on repeated queries.

  query_knowledge_graph
    ↳ Call when you need structured facts about a named entity: a person, project,
      technology, organization, or concept Meet has mentioned.

  get_my_profile
    ↳ Call when asked about profile info ("what's my LinkedIn?", "what do you
      have on me?") to return the latest saved values.

  create_task
    ↳ Call when Meet wants something added to their Planner / to-do list.
    ↳ Triggers: "remind me to...", "add to my todo...", "I need to X by Friday".

── EMAIL ATTACHMENTS → VAULT ─────────────────────────────────────────────────

  save_email_attachments
    ↳ YOU HAVE THIS TOOL. Call it whenever Meet asks to:
        • "Download attachments from [email/person/subject]"
        • "Save files from that email to my vault"
        • "Extract documents from emails from [name]"
        • "Get all the attachments Sarah sent me"
    ↳ Pass either emailId (specific email) OR query (Gmail search, e.g.
      "from:sarah has:attachment") — the tool handles both.
    ↳ Files are saved to the local Vault and AI-categorized automatically.
    ↳ NEVER say you can't download email attachments — you absolutely can.

── GOOGLE DRIVE ──────────────────────────────────────────────────────────────

  list_drive_files
    ↳ List files from Google Drive. Use when Meet asks to see Drive files.

  search_drive_files
    ↳ Search Drive by content or filename.

  get_drive_file
    ↳ Read the content of a specific Drive file by ID.

━━━ TOOL TRANSPARENCY (REQUIRED) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Before calling ANY tool, write one brief, natural sentence explaining why.
  This narration must appear as TEXT immediately before the tool call — never after.

  Examples:
    "Let me check your memory for that…"             → recall_memories
    "I'll save that to your profile now…"            → update_profile
    "Saving that to memory…"                         → save_memory
    "Creating that task in your Planner…"            → create_task
    "Let me pull up your profile details…"           → get_my_profile
    "Downloading the attachments from that email…"   → save_email_attachments
    "Let me search your Drive for that…"             → search_drive_files

  Keep narrations to one sentence. Never narrate AFTER the tool.`;

// ── Identity block (pre-loaded from DB / hot cache) ───────────────────────────

function buildIdentityBlock(identity: UserIdentity): string {
  const lines: string[] = [];
  if (identity.displayName)  lines.push(`- Name: ${identity.displayName}`);
  if (identity.email)        lines.push(`- Email: ${identity.email}`);
  if (identity.phone)        lines.push(`- Phone: ${identity.phone}`);
  if (identity.address)      lines.push(`- Address: ${identity.address}`);
  if (identity.linkedin)     lines.push(`- LinkedIn: ${identity.linkedin}`);
  if (identity.portfolioWeb) lines.push(`- Portfolio / Website: ${identity.portfolioWeb}`);
  if (identity.instagram)    lines.push(`- Instagram: ${identity.instagram}`);
  if (identity.xHandle)      lines.push(`- X (Twitter): ${identity.xHandle}`);
  if (identity.facebook)     lines.push(`- Facebook: ${identity.facebook}`);
  return lines.join("\n");
}

// ── Context deduplication ─────────────────────────────────────────────────────
// If an entity name already appears verbatim in recent history, strip it from
// relevantEntities to avoid wasting prompt tokens on redundant context.

function deduplicateEntities(ctx: MemoryContext): MemoryContext {
  if (ctx.relevantEntities.length === 0 || ctx.recentHistory.length === 0) {
    return ctx;
  }

  // Build a single string from recent history for fast substring matching
  const historyText = ctx.recentHistory
    .map((t) => t.content)
    .join(" ")
    .toLowerCase();

  const filtered = ctx.relevantEntities.filter(
    (e) => !historyText.includes(e.name.toLowerCase())
  );

  return { ...ctx, relevantEntities: filtered };
}

// ── Main builder ──────────────────────────────────────────────────────────────
// Prompt section order (highest priority → lowest):
//   1. IDENTITY + HARD RULES + TOOLS  (always first, always seen)
//   2. COMMUNICATION STYLE
//   3. USER PROFILE (ground-truth identity fields)
//   4. AI PROFILE (L4 — learned from conversations)
//   5. ENTITIES (L3 — compressed, top-N by decay score)
//   6. RECENT HISTORY (L1 — last 10 turns max)
//   7. SEMANTIC CONTEXT (L2 — only if retrieved)
//   8. SESSION SUMMARIES (compressed past sessions)

export function buildSystemPrompt(
  rawCtx: MemoryContext,
  retrievalCtx?: RetrievalContext,
  agentSystemPrompt?: string
): string {
  // Deduplicate before serializing
  const ctx = deduplicateEntities(rawCtx);

  // If an agent-specific prompt is provided, use it in place of the default identity block
  const identityBlock = agentSystemPrompt ?? IDENTITY_AND_RULES;
  const parts: string[] = [identityBlock];

  // 2. Communication style (adapt tone)
  if (ctx.styleNote) {
    parts.push(`\n━━━ COMMUNICATION STYLE (adapt your responses to this) ━━━━━━━━━━━━━━━━━━━━━\n${ctx.styleNote}`);
  }

  // 3. User profile — explicitly entered by Meet in Settings → Profile.
  if (ctx.userIdentity) {
    const block = buildIdentityBlock(ctx.userIdentity);
    if (block) {
      parts.push(`\n━━━ MEET'S PROFILE (ground truth — do not contradict) ━━━━━━━━━━━━━━━━━━━━━━━\n${block}`);
    }
  }

  // 4. L4 Profile — AI-generated summary rebuilt from conversations.
  if (ctx.profile) {
    parts.push(`\n━━━ WHAT YOU KNOW ABOUT MEET (learned from conversations) ━━━━━━━━━━━━━━━━━━━\n${ctx.profile}`);
  }

  // 5. L3 Entities (already deduplicated against recent history)
  if (ctx.relevantEntities.length > 0) {
    const entityLines = ctx.relevantEntities.map((e) => {
      const rels = e.relationships
        .map((r) => `  - ${r.predicate}: ${r.objectValue}`)
        .join("\n");
      return `- ${e.name} (${e.type})${rels ? "\n" + rels : ""}`;
    });
    parts.push(`\n━━━ KNOWN PEOPLE, PROJECTS & ENTITIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${entityLines.join("\n")}`);
  }

  // 6. L1 Recent history — verbatim turns across sessions
  if (ctx.recentHistory.length > 0) {
    const bySession = new Map<string, typeof ctx.recentHistory>();
    for (const turn of ctx.recentHistory) {
      const turns = bySession.get(turn.sessionId) ?? [];
      turns.push(turn);
      bySession.set(turn.sessionId, turns);
    }
    const sessionEntries = [...bySession.entries()];
    const lines: string[] = [];
    sessionEntries.forEach(([, turns], idx) => {
      const date = new Date(turns[0].createdAt).toLocaleDateString("en", {
        weekday: "short", month: "short", day: "numeric",
      });
      const label = idx === sessionEntries.length - 1
        ? `Current session (${date})`
        : `Session ${idx + 1} (${date})`;
      lines.push(`### ${label}`);
      for (const t of turns) {
        const role = t.role === "user" ? "Meet" : "You";
        lines.push(`${role}: ${t.content.slice(0, 400)}${t.content.length > 400 ? "…" : ""}`);
      }
    });
    parts.push(`\n━━━ RECENT CONVERSATION HISTORY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${lines.join("\n")}`);
  }

  // 7. L2 Semantic memories (pre-loaded for context queries)
  if (ctx.relevantMemories.length > 0) {
    const deduped = [...new Set(ctx.relevantMemories)];
    parts.push(`\n━━━ RELEVANT PAST CONTEXT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${deduped.map((m) => `- ${m.slice(0, 300)}`).join("\n")}`);
  }

  // 7.5. Pre-fetched retrieval context (from runRetrievalAgent — runs before prompt build)
  if (retrievalCtx) {
    if (retrievalCtx.semanticChunks.length > 0) {
      const chunkLines = retrievalCtx.semanticChunks
        .map((c) => `- [${(c.similarity * 100).toFixed(0)}% match] ${c.text.slice(0, 300)}`)
        .join("\n");
      parts.push(`\n━━━ PRE-FETCHED SEMANTIC MEMORIES (recency-weighted) ━━━━━━━━━━━━━━━━━━━━━━━━\n${chunkLines}`);
    }
    if (retrievalCtx.dedupedFacts.length > 0) {
      parts.push(`\n━━━ PRE-FETCHED ENTITY FACTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${retrievalCtx.dedupedFacts.map((f) => `- ${f}`).join("\n")}`);
    }
  }

  // 8. Session summaries (compressed past sessions)
  if (ctx.sessionSummaries.length > 0) {
    parts.push(`\n━━━ PAST SESSION SUMMARIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${ctx.sessionSummaries.join("\n")}`);
  }

  return parts.join("\n");
}
