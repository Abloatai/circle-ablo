CREATE TABLE "issue_pull_request" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ablo_tenant_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "issue_pull_request_issue_idx" ON "issue_pull_request" USING btree ("issue_id");