ALTER TABLE "project" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "description" text DEFAULT '' NOT NULL;