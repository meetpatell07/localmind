import {
  pgTable, text, timestamp, uuid, integer, real,
  jsonb, boolean, index, serial, varchar,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// ── L1: EPISODIC MEMORY ─────────────────────

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  channel: varchar("channel", { length: 50 }).default("chat"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("conv_session_idx").on(t.sessionId),
  index("conv_created_idx").on(t.createdAt),
]);

// ── L2: SEMANTIC MEMORY (pgvector) ──────────
// After first migration, run in Neon SQL Editor:
//   CREATE EXTENSION IF NOT EXISTS vector;
//   ALTER TABLE embeddings ADD COLUMN embedding vector(768);
//   CREATE INDEX embed_hnsw_idx ON embeddings
//     USING hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64);

export const embeddings = pgTable("embeddings", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentText: text("content_text").notNull(),
  sourceType: varchar("source_type", { length: 30 }).notNull(),
  sourceId: uuid("source_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("embed_source_idx").on(t.sourceType),
]);

// ── L3: ENTITIES + RELATIONSHIPS ────────────

export const entities = pgTable("entities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]),
  attributes: jsonb("attributes").$type<Record<string, unknown>>().default({}),
  // Graphiti-style: LLM-generated evolving summary rebuilt as entity is mentioned more
  summary: text("summary"),
  mentionCount: integer("mention_count").default(1),
  firstSeen: timestamp("first_seen", { withTimezone: true }).defaultNow().notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
  // ── Intelligent decay ────────────────────────────────────────────────────
  // Starts at 1.0, decays exponentially based on type-specific half-life.
  // Refreshed toward 1.0 each time the entity is re-mentioned in conversation.
  decayScore: real("decay_score").default(1.0).notNull(),
}, (t) => [
  index("entity_name_idx").on(t.name),
  index("entity_type_idx").on(t.type),
  index("entity_decay_idx").on(t.decayScore),
]);

export const relationships = pgTable("relationships", {
  id: uuid("id").defaultRandom().primaryKey(),
  subjectId: uuid("subject_id").references(() => entities.id, { onDelete: "cascade" }).notNull(),
  predicate: varchar("predicate", { length: 100 }).notNull(),
  objectEntityId: uuid("object_entity_id").references(() => entities.id, { onDelete: "cascade" }),
  objectValue: text("object_value"),
  confidence: real("confidence").default(0.8),
  sourceConversationId: uuid("source_conversation_id").references(() => conversations.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  // ── Version / mutation tracking ─────────────────────────────────────────
  // When a fact changes (e.g. "deadline moved to Monday"), the old edge gets:
  //   isActive=false, validUntil=now(), supersededById=<new edge id>
  // The new edge gets factVersion = old.factVersion + 1.
  // This preserves full history while the graph query only reads isActive=true.
  factVersion:    integer("fact_version").default(1).notNull(),
  validFrom:      timestamp("valid_from",  { withTimezone: true }).defaultNow().notNull(),
  validUntil:     timestamp("valid_until", { withTimezone: true }),
  supersededById: uuid("superseded_by_id").references((): AnyPgColumn => relationships.id),
  decayScore:     real("decay_score").default(1.0).notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("rel_subject_idx").on(t.subjectId),
  index("rel_predicate_idx").on(t.predicate),
  index("rel_active_idx").on(t.isActive),
  index("rel_version_idx").on(t.factVersion),
]);

// ── L3b: ATOMIC FACTS ───────────────────────
// Granular single-sentence facts extracted from conversations/documents.
// Each fact is independently embedded and versioned.
// Example: "The project deadline is Friday" → entity: Project, pred: deadline, val: Friday

export const atomicFacts = pgTable("atomic_facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  // The entity this fact is primarily about
  entityId: uuid("entity_id").references(() => entities.id, { onDelete: "cascade" }).notNull(),
  // Human-readable fact sentence, also stored as an embedding chunk
  rawFact: text("raw_fact").notNull(),
  predicate: varchar("predicate", { length: 100 }),
  objectValue: text("object_value"),
  confidence: real("confidence").default(0.8),
  // Active state — false when superseded
  isActive: boolean("is_active").default(true),
  // Version chain: supersededById points to the newer fact that replaced this one
  factVersion:    integer("fact_version").default(1).notNull(),
  validFrom:      timestamp("valid_from",  { withTimezone: true }).defaultNow().notNull(),
  validUntil:     timestamp("valid_until", { withTimezone: true }),
  supersededById: uuid("superseded_by_id").references((): AnyPgColumn => atomicFacts.id),
  sourceConversationId: uuid("source_conversation_id").references(() => conversations.id),
  decayScore:     real("decay_score").default(1.0).notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("fact_entity_idx").on(t.entityId),
  index("fact_active_idx").on(t.isActive),
  index("fact_predicate_idx").on(t.predicate),
]);

// ── USER IDENTITY ────────────────────────────
// Single-row table for the owner's personal info.
// Used to personalise the AI system prompt and pre-fill task/email context.

export const userProfile = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  // Identity
  displayName: varchar("display_name", { length: 200 }),
  email:       varchar("email",        { length: 255 }),
  phone:       varchar("phone",        { length: 50 }),
  address:     text("address"),
  // Social / professional links
  linkedin:    varchar("linkedin",     { length: 500 }),
  portfolioWeb: varchar("portfolio_web", { length: 500 }),
  instagram:   varchar("instagram",   { length: 200 }),
  xHandle:     varchar("x_handle",    { length: 200 }),  // Twitter/X @handle
  facebook:    varchar("facebook",    { length: 500 }),
  // Timestamps
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── L4: AI MEMORY PROFILE ────────────────────
// AI-generated summary rebuilt from entities/relationships every 50 interactions.
// Separate from userProfile — this is what the AI knows, not who the user is.

export const profile = pgTable("profile", {
  id: serial("id").primaryKey(),
  summaryText: text("summary_text").notNull(),
  facts: jsonb("facts").$type<string[]>().default([]),
  interactionCountAtRebuild: integer("interaction_count_at_rebuild").default(0),
  lastRebuilt: timestamp("last_rebuilt", { withTimezone: true }).defaultNow().notNull(),
});

// ── SESSIONS ────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  channel: varchar("channel", { length: 50 }).default("chat"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  turnCount: integer("turn_count").default(0),
  summary: text("summary"),
});

// ── PLANNER ─────────────────────────────────

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("todo").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  tags: jsonb("tags").$type<string[]>().default([]),
  recurrence: varchar("recurrence", { length: 30 }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("tasks_status_idx").on(t.status),
  index("tasks_due_idx").on(t.dueDate),
]);

// ── FILE VAULT METADATA ─────────────────────

export const vaultFiles = pgTable("vault_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  filePath: text("file_path").notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  tags: jsonb("tags").$type<string[]>().default([]),
  summary: text("summary"),
  // AI-assigned category (Finance, Code, Documents, Images, Notes, Archive, Other)
  category: varchar("category", { length: 100 }).default("Other"),
  // Upload source: "web" | "telegram" | "api"
  source: varchar("source", { length: 50 }).default("web"),
  // Telegram file_id for de-duplication
  telegramFileId: varchar("telegram_file_id", { length: 300 }),
  isIndexed: boolean("is_indexed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("vault_name_idx").on(t.fileName),
  index("vault_category_idx").on(t.category),
  index("vault_source_idx").on(t.source),
]);

// ── SETTINGS ────────────────────────────────

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── CONNECTORS ───────────────────────────────
// Tracks which external service integrations are connected.
// OAuth tokens are stored separately in the settings table under
// "connector:<provider>:tokens" to keep credentials isolated.

export const connectors = pgTable("connectors", {
  id: serial("id").primaryKey(),
  provider: varchar("provider", { length: 50 }).notNull().unique(), // "google", "notion"
  isActive: boolean("is_active").default(false).notNull(),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncStatus: varchar("sync_status", { length: 20 }).default("idle"), // idle | syncing | error
  errorMessage: text("error_message"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("connector_provider_idx").on(t.provider),
]);

// ── MEETINGS ─────────────────────────────────
// Stores recorded/transcribed meeting data with AI-extracted action items.

export const meetings = pgTable("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 500 }).notNull().default("Untitled Meeting"),
  participants: jsonb("participants").$type<string[]>().default([]),
  transcript: text("transcript").notNull().default(""),
  summary: text("summary"),
  actionItems: jsonb("action_items").$type<Array<{
    task: string;
    assignee?: string;
    dueDate?: string;
    priority: string;
  }>>().default([]),
  decisions: jsonb("decisions").$type<string[]>().default([]),
  topics: jsonb("topics").$type<string[]>().default([]),
  tasksCreated: integer("tasks_created").default(0),
  durationSeconds: integer("duration_seconds"),
  source: varchar("source", { length: 50 }).default("recorded"), // "recorded" | "pasted"
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("meetings_created_idx").on(t.createdAt),
]);
