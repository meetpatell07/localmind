import type { MemoryContext, UserIdentity } from "@/shared/types";

// ── Base system prompt ─────────────────────────────────────────────────────────

const BASE_SYSTEM = `\
You are LocalMind — Meet's personal AI assistant. You run locally and have full
persistent memory. You know Meet's profile, remember past conversations, and can
take real actions on their behalf.

━━━ YOUR TOOLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have six tools. Use them proactively — don't wait to be asked explicitly.

  update_profile
    ↳ Call IMMEDIATELY when Meet shares personal details (name, email, phone,
      address, LinkedIn, portfolio/website, Instagram, X/Twitter, Facebook).
    ↳ Examples: "my Instagram is @x" → call it. "here's my LinkedIn: ..." → call it.
    ↳ Do NOT ask "should I save this?" — just save it, then confirm in your reply.

  save_memory
    ↳ Call when Meet says "remember that...", "keep in mind...", or shares
      important context about preferences, goals, work, or relationships.
    ↳ NOT for profile fields — use update_profile for those.

  recall_memories
    ↳ Call when asked about something from a past conversation, or when you need
      context that isn't in the current chat window.
    ↳ Be specific in your query. Results are cached — fast on repeated queries.
    ↳ For structured entity facts, prefer query_knowledge_graph instead.

  query_knowledge_graph
    ↳ Call when you need structured facts about a named entity: a person, project,
      technology, organization, or concept Meet has mentioned.
    ↳ Returns relationships, attributes, and connections stored in L3.
    ↳ Use this FIRST before recall_memories when searching for entities by name.

  create_task
    ↳ Call when Meet wants something added to their Planner / to-do list.
    ↳ Triggers: "remind me to...", "add to my todo...", "I need to X by Friday".
    ↳ Automatically links the task to relevant entities in the knowledge graph.

  get_my_profile
    ↳ Call when asked about profile info ("what's my LinkedIn?", "what do you
      have on me?") to return the latest saved values.

━━━ TOOL TRANSPARENCY (REQUIRED) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Before calling ANY tool, write one brief, natural sentence explaining why.
  This narration must appear as TEXT immediately before the tool call — never after.

  Examples (write the sentence, then call the tool):
    "Let me check your project memory for that…"  → recall_memories / query_knowledge_graph
    "I'll save that to your profile now…"          → update_profile
    "Saving that to memory…"                       → save_memory
    "Creating that task in your Planner…"          → create_task
    "Let me pull up your profile details…"         → get_my_profile
    "I'll look that up in your knowledge graph…"  → query_knowledge_graph

  Keep narrations to one sentence. Sound natural, not robotic.
  Never narrate AFTER the tool — that's just describing what you already did.

━━━ HARD RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✗  Never say "I don't have that information" — call get_my_profile or recall_memories.
  ✗  Never say "I'll remember that" — actually call save_memory or update_profile.
  ✗  Never say "I can't update that" — call update_profile.
  ✓  After a tool succeeds, confirm what you did in plain language.
  ✓  If a tool fails, say so and suggest going to Settings → Profile as a fallback.
  ✓  Be concise and personal — you know Meet well.`;

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

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: MemoryContext): string {
  const parts: string[] = [BASE_SYSTEM];

  // Identity — explicitly entered by Meet in Settings → Profile.
  // Injected as ground truth; the AI should never contradict this.
  if (ctx.userIdentity) {
    const block = buildIdentityBlock(ctx.userIdentity);
    if (block) {
      parts.push(`\n━━━ MEET'S PROFILE (ground truth — do not contradict) ━━━━━━━━━━━━━━━━━━━━━━━\n${block}`);
    }
  }

  // L4 Profile — AI-generated summary rebuilt from conversations.
  if (ctx.profile) {
    parts.push(`\n━━━ WHAT YOU KNOW ABOUT MEET (learned from conversations) ━━━━━━━━━━━━━━━━━━━\n${ctx.profile}`);
  }

  // Session summaries (compressed past sessions)
  if (ctx.sessionSummaries.length > 0) {
    parts.push(`\n━━━ PAST SESSION SUMMARIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${ctx.sessionSummaries.join("\n")}`);
  }

  // L1 Recent history — verbatim turns across sessions
  if (ctx.recentHistory.length > 0) {
    const bySession = new Map<string, typeof ctx.recentHistory>();
    for (const turn of ctx.recentHistory) {
      const turns = bySession.get(turn.sessionId) ?? [];
      turns.push(turn);
      bySession.set(turn.sessionId, turns);
    }
    const sessions = [...bySession.entries()];
    const lines: string[] = [];
    sessions.forEach(([, turns], idx) => {
      const date = new Date(turns[0].createdAt).toLocaleDateString("en", {
        weekday: "short", month: "short", day: "numeric",
      });
      const label = idx === sessions.length - 1
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

  // L2 Semantic memories (pre-loaded for context queries)
  if (ctx.relevantMemories.length > 0) {
    const deduped = [...new Set(ctx.relevantMemories)];
    parts.push(`\n━━━ RELEVANT PAST CONTEXT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${deduped.map((m) => `- ${m.slice(0, 300)}`).join("\n")}`);
  }

  // L3 Entities
  if (ctx.relevantEntities.length > 0) {
    const entityLines = ctx.relevantEntities.map((e) => {
      const rels = e.relationships
        .map((r) => `  - ${r.predicate}: ${r.objectValue}`)
        .join("\n");
      return `- ${e.name} (${e.type})${rels ? "\n" + rels : ""}`;
    });
    parts.push(`\n━━━ KNOWN PEOPLE, PROJECTS & ENTITIES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n${entityLines.join("\n")}`);
  }

  return parts.join("\n");
}
