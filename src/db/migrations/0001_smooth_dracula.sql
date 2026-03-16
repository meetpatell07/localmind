CREATE TABLE "atomic_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"raw_fact" text NOT NULL,
	"predicate" varchar(100),
	"object_value" text,
	"confidence" real DEFAULT 0.8,
	"is_active" boolean DEFAULT true,
	"fact_version" integer DEFAULT 1 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_until" timestamp with time zone,
	"superseded_by_id" uuid,
	"source_conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "fact_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "valid_from" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "relationships" ADD COLUMN "superseded_by_id" uuid;--> statement-breakpoint
ALTER TABLE "atomic_facts" ADD CONSTRAINT "atomic_facts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atomic_facts" ADD CONSTRAINT "atomic_facts_superseded_by_id_atomic_facts_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."atomic_facts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atomic_facts" ADD CONSTRAINT "atomic_facts_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fact_entity_idx" ON "atomic_facts" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "fact_active_idx" ON "atomic_facts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "fact_predicate_idx" ON "atomic_facts" USING btree ("predicate");--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_superseded_by_id_relationships_id_fk" FOREIGN KEY ("superseded_by_id") REFERENCES "public"."relationships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rel_active_idx" ON "relationships" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "rel_version_idx" ON "relationships" USING btree ("fact_version");