CREATE TABLE "connectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"last_sync_at" timestamp with time zone,
	"sync_status" varchar(20) DEFAULT 'idle',
	"error_message" text,
	"connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connectors_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE INDEX "connector_provider_idx" ON "connectors" USING btree ("provider");