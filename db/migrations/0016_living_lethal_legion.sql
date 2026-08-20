ALTER TABLE "label" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "label" ADD COLUMN "parent_id" text;--> statement-breakpoint
CREATE INDEX "label_parent_idx" ON "label" USING btree ("parent_id");