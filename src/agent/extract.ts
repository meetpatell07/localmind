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
        predicate: z.string().min(1).max(80),
        object: z.string().min(1).max(200),
        confidence: z.number().min(0).max(1).default(0.8),
      })
    )
    .max(30)
    .default([]),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `You are a knowledge-graph extractor. Given a conversation, output a JSON object with entities and relationships that form a personal knowledge graph.

Entity types:
  person       → named individuals (use real name — if user says "I" or "my", use their actual name if known; otherwise skip)
  project      → software projects, products, codebases, features, side projects
  technology   → languages, frameworks, libraries, tools, services, platforms, APIs
  preference   → stated likes, dislikes, habits, working style, opinions, values
  concept      → abstract ideas, methodologies, domains, skills
  organization → companies, teams, departments, clients, communities
  event        → meetings, releases, deadlines, milestones, incidents
  other        → locations, documents, resources that don't fit above

Relationship predicates must be short snake_case verb phrases:
  Person relations:   has_role, works_at, knows, manages, reports_to, collaborates_with, lives_in
  Project relations:  works_on, built, owns, uses_technology, has_feature, blocked_by, depends_on
  Tech relations:     built_with, integrates_with, is_part_of, replaces, similar_to
  Preference:         prefers, dislikes, interested_in, learning, values
  Temporal:           started_on, completed_on, deadline_is, happened_on
  General:            is_a, has_attribute, located_at, created_by, used_for

Rules:
1. Only extract facts that are explicitly stated — no inference or speculation.
2. Represent every named person, project, tool, or organization mentioned as an entity.
3. Prefer canonical names: "TypeScript" not "TS", "PostgreSQL" not "postgres".
4. For the primary user speaking, use their real name if you know it; if not, skip "I"/"me" entities.
5. Each relationship triple must have a clear subject AND object from the entities list.
6. Skip trivial meta-entities: "question", "response", "message", "conversation", "answer".
7. Confidence: 0.95 = explicitly stated, 0.8 = clearly implied, 0.6 = mentioned in passing.
8. Return empty arrays if the conversation contains no meaningful facts.`;

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
