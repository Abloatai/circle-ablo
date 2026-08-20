CREATE TABLE "issue_link" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ablo_tenant_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" text,
	"issue_id" text NOT NULL,
	"related_issue_id" text NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "milestone_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_link_idx" ON "issue_link" USING btree ("issue_id","related_issue_id","type");--> statement-breakpoint
CREATE INDEX "issue_link_related_idx" ON "issue_link" USING btree ("related_issue_id");