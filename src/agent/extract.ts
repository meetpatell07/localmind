import { generateObject } from "ai";
import { z } from "zod";
import { extractionModel } from "./ollama";
import { EXTRACTION_TEMPERATURE } from "@/shared/constants";

// ── Strict entity type enum ───────────────────────────────────────────────────
// Constrained so the model can't invent free-form category strings.
const EntityTypeSchema = z.enum([
  "person",
  "project",
  "technology",
  "preference",
  "concept",
  "organization",
  "event",
  "other",
]);

// ── Extraction output schema ──────────────────────────────────────────────────
// Exported so entity.ts can reference the inferred type.
export const ExtractionSchema = z.object({
  entities: z
    .array(
      z.object({
        // Canonical proper name — never a pronoun or "the user"
        name: z.string().min(1).max(100).trim(),
        type: EntityTypeSchema,
        // Flat string-to-string attributes only: avoids deeply-nested garbage
        // from small models (e.g. Qwen 7B).
        attributes: z.record(z.string(), z.string()).optional().default({}),
      })
    )
    .max(15)
    .default([]),

  relationships: z
    .array(
      z.object({
        subject: z.string().min(1).max(100),
        // Short snake_case verb phrase: works_on, uses, prefers, owns, …
        predicate: z.string().min(1).max(60),
        object: z.string().min(1).max(100),
        confidence: z.number().min(0).max(1).default(0.8),
      })
    )
    .max(20)
    .default([]),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `You are a knowledge-graph extractor. Given a conversation transcript, output a JSON object with entities and relationships.

Entity types:
  person       → named individuals (use real name, never "the user" or "I")
  project      → software projects, products, codebases, features
  technology   → languages, frameworks, libraries, tools, services, platforms
  preference   → stated likes, dislikes, habits, working style, opinions
  concept      → abstract ideas, methodologies, domains
  organization → companies, teams, departments, open-source communities
  event        → meetings, releases, deadlines, incidents
  other        → anything that doesn't fit above

Relationship predicates must be short snake_case verb phrases, e.g.:
  works_on, uses, knows, prefers, built, owns, manages, is_part_of,
  dislikes, has_role, works_at, interested_in, learning, blocked_by

Rules:
1. Only extract facts that are clearly stated — no speculation.
2. If the user refers to themselves by name, use that exact name as the entity.
3. Prefer canonical names: "TypeScript" not "TS", "React" not "react.js".
4. Skip trivial/meta entities: "question", "response", "message", "conversation".
5. Return empty arrays if nothing meaningful is present.`;

// ── Main extraction function ──────────────────────────────────────────────────
/**
 * Asynchronously extract entities and relationships from a chat exchange.
 * Returns null on timeout, parse failure, or empty result.
 * NEVER throws — caller can fire-and-forget safely.
 */
export async function extractEntitiesFromConversation(
  userMessage: string,
  assistantMessage: string
): Promise<ExtractionResult | null> {
  // Skip trivially short exchanges — not worth the inference cost
  if (userMessage.trim().length < 15) return null;

  const transcript = [
    `User: ${userMessage.slice(0, 1500)}`,
    `Assistant: ${assistantMessage.slice(0, 1500)}`,
  ].join("\n");

  try {
    const { object } = await generateObject({
      model: extractionModel,
      schema: ExtractionSchema,
      // output: "object" (default) — injects JSON schema into the system prompt.
      // Correct for Ollama via OpenAI-compat (no native function-calling needed).
      output: "object",
      system: SYSTEM,
      prompt: `Extract entities and relationships from this conversation:\n\n${transcript}`,
      temperature: EXTRACTION_TEMPERATURE,
      // Hard 45 s ceiling — never block the async post-response pipeline
      abortSignal: AbortSignal.timeout(45_000),
    });

    if (object.entities.length === 0 && object.relationships.length === 0) {
      return null;
    }

    return object;
  } catch {
    // Timeout, schema mismatch, model offline → silently drop per spec
    return null;
  }
}
