import {
  pgTable, text, timestamp, uuid, integer, real,
  jsonb, boolean, index, serial, varchar,
} from "drizzle-orm/pg-core";

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
  mentionCount: integer("mention_count").default(1),
  firstSeen: timestamp("first_seen", { withTimezone: true }).defaultNow().notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("entity_name_idx").on(t.name),
  index("entity_type_idx").on(t.type),
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
}, (t) => [
  index("rel_subject_idx").on(t.subjectId),
  index("rel_predicate_idx").on(t.predicate),
]);

// ── L4: USER PROFILE ────────────────────────

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
  isIndexed: boolean("is_indexed").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("vault_name_idx").on(t.fileName),
]);

// ── SETTINGS ────────────────────────────────

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
