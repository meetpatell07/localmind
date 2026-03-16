import type { MemoryContext } from "@/shared/types";

const BASE_SYSTEM = `You are LocalMind, a personal AI agent for Meet. You run locally, remember context across conversations, and help with daily tasks, thinking, planning, and questions. Be concise, direct, and helpful. You know Meet personally — use that context.`;

export function buildSystemPrompt(ctx: MemoryContext): string {
  const parts: string[] = [BASE_SYSTEM];

  if (ctx.profile) {
    parts.push(`\n## About Meet\n${ctx.profile}`);
  }

  if (ctx.relevantMemories.length > 0) {
    parts.push(`\n## Relevant Context\n${ctx.relevantMemories.join("\n")}`);
  }

  if (ctx.relevantEntities.length > 0) {
    const entityLines = ctx.relevantEntities.map((e) => {
      const rels = e.relationships
        .map((r) => `  - ${r.predicate}: ${r.objectValue}`)
        .join("\n");
      return `- ${e.name} (${e.type})${rels ? "\n" + rels : ""}`;
    });
    parts.push(`\n## Known Entities\n${entityLines.join("\n")}`);
  }

  return parts.join("\n");
}

export function buildExtractionPrompt(conversation: string): string {
  return `Extract entities and relationships from this conversation. Return ONLY valid JSON matching this schema:
{
  "entities": [{"name": "string", "type": "person|place|project|technology|concept|event|other", "attributes": {}}],
  "relationships": [{"subject": "entity name", "predicate": "verb/relation", "object": "entity name or value", "confidence": 0.8}]
}

Conversation:
${conversation}

JSON:`;
}
