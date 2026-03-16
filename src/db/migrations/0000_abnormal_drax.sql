CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"channel" varchar(50) DEFAULT 'chat',
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_text" text NOT NULL,
	"source_type" varchar(30) NOT NULL,
	"source_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb,
	"attributes" jsonb DEFAULT '{}'::jsonb,
	"mention_count" integer DEFAULT 1,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"summary_text" text NOT NULL,
	"facts" jsonb DEFAULT '[]'::jsonb,
	"interaction_count_at_rebuild" integer DEFAULT 0,
	"last_rebuilt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"predicate" varchar(100) NOT NULL,
	"object_entity_id" uuid,
	"object_value" text,
	"confidence" real DEFAULT 0.8,
	"source_conversation_id" uuid,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" varchar(50) DEFAULT 'chat',
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"turn_count" integer DEFAULT 0,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'todo' NOT NULL,
	"priority" varchar(20) DEFAULT 'medium',
	"due_date" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"recurrence" varchar(30),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_path" text NOT NULL,
	"mime_type" varchar(100),
	"size_bytes" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"summary" text,
	"is_indexed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_subject_id_entities_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_object_entity_id_entities_id_fk" FOREIGN KEY ("object_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_source_conversation_id_conversations_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conv_session_idx" ON "conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "conv_created_idx" ON "conversations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "embed_source_idx" ON "embeddings" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "entity_name_idx" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "entity_type_idx" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "rel_subject_idx" ON "relationships" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "rel_predicate_idx" ON "relationships" USING btree ("predicate");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "vault_name_idx" ON "vault_files" USING btree ("file_name");