CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(500) DEFAULT 'Untitled Meeting' NOT NULL,
	"participants" jsonb DEFAULT '[]'::jsonb,
	"transcript" text DEFAULT '' NOT NULL,
	"summary" text,
	"action_items" jsonb DEFAULT '[]'::jsonb,
	"decisions" jsonb DEFAULT '[]'::jsonb,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"tasks_created" integer DEFAULT 0,
	"duration_seconds" integer,
	"source" varchar(50) DEFAULT 'recorded',
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "meetings_created_idx" ON "meetings" USING btree ("created_at");
