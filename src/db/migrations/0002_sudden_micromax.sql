ALTER TABLE "atomic_facts" ADD COLUMN "decay_score" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "decay_score" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "decay_score" real DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX "entity_decay_idx" ON "entities" USING btree ("decay_score");