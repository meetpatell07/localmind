import type { MemoryContext } from "@/shared/types";

const BASE_SYSTEM = `You are LocalMind, a personal AI assistant running locally for Meet. You have persistent memory across all conversations — you remember everything Meet tells you, including past discussions, preferences, projects, and facts about their life.

IMPORTANT RULES:
- You DO have access to past conversations. They are provided below in the memory sections.
- When Meet asks "what did we talk about last time?" or similar, refer to the "Recent Conversation History" section below.
- NEVER say you don't have access to previous conversations — you do. Use the context provided.
- Be concise, direct, and personal. You know Meet well — speak accordingly.
- If memory sections are empty, it means no prior conversations exist yet — say so honestly.`;

export function buildSystemPrompt(ctx: MemoryContext): string {
  const parts: string[] = [BASE_SYSTEM];

  // L4 Profile
  if (ctx.profile) {
    parts.push(`\n## About Meet\n${ctx.profile}`);
  }

  // Session summaries (compressed history of past sessions)
  if (ctx.sessionSummaries.length > 0) {
    parts.push(`\n## Past Session Summaries\n${ctx.sessionSummaries.join("\n")}`);
  }

  // L1 Recent conversation history (verbatim turns)
  if (ctx.recentHistory.length > 0) {
    // Group by session to make it readable
    const bySession = new Map<string, typeof ctx.recentHistory>();
    for (const turn of ctx.recentHistory) {
      const turns = bySession.get(turn.sessionId) ?? [];
      turns.push(turn);
      bySession.set(turn.sessionId, turns);
    }

    const sessions = [...bySession.entries()];
    const lines: string[] = [];

    sessions.forEach(([, turns], idx) => {
      const first = turns[0];
      const date = new Date(first.createdAt).toLocaleDateString("en", {
        weekday: "short", month: "short", day: "numeric",
      });
      const label = idx === sessions.length - 1 ? `Current session (${date})` : `Session ${idx + 1} (${date})`;
      lines.push(`### ${label}`);
      for (const t of turns) {
        const role = t.role === "user" ? "Meet" : "You";
        lines.push(`${role}: ${t.content.slice(0, 400)}${t.content.length > 400 ? "…" : ""}`);
      }
    });

    parts.push(`\n## Recent Conversation History\n${lines.join("\n")}`);
  }

  // L2 Semantic memories (relevant past context chunks)
  if (ctx.relevantMemories.length > 0) {
    const deduped = [...new Set(ctx.relevantMemories)];
    parts.push(`\n## Relevant Past Context\n${deduped.map((m) => `- ${m.slice(0, 300)}`).join("\n")}`);
  }

  // L3 Known entities
  if (ctx.relevantEntities.length > 0) {
    const entityLines = ctx.relevantEntities.map((e) => {
      const rels = e.relationships
        .map((r) => `  - ${r.predicate}: ${r.objectValue}`)
        .join("\n");
      return `- ${e.name} (${e.type})${rels ? "\n" + rels : ""}`;
    });
    parts.push(`\n## Known People, Projects & Entities\n${entityLines.join("\n")}`);
  }

  return parts.join("\n");
}

// Extraction prompt is now owned by src/agent/extract.ts (uses generateObject).
