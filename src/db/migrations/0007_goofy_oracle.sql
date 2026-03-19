ALTER TABLE "vault_files" ADD COLUMN "category" varchar(100) DEFAULT 'Other';--> statement-breakpoint
ALTER TABLE "vault_files" ADD COLUMN "source" varchar(50) DEFAULT 'web';--> statement-breakpoint
ALTER TABLE "vault_files" ADD COLUMN "telegram_file_id" varchar(300);--> statement-breakpoint
CREATE INDEX "vault_category_idx" ON "vault_files" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vault_source_idx" ON "vault_files" USING btree ("source");