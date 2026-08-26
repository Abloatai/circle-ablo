CREATE TABLE "review_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ablo_tenant_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"model" text NOT NULL,
	"phase" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"recommendation" text,
	"confidence" real,
	"result" jsonb,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_finding" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ablo_tenant_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"category" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"evidence" text NOT NULL,
	"path" text,
	"line" integer,
	"raised_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"challenged_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolution" text DEFAULT 'confirmed' NOT NULL,
	"confidence" real NOT NULL,
	"fingerprint" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_mission" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ablo_tenant_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"team_id" text NOT NULL,
	"issue_id" text NOT NULL,
	"repository_id" text NOT NULL,
	"pull_request_url" text NOT NULL,
	"repository" text NOT NULL,
	"pull_number" integer NOT NULL,
	"head_sha" text NOT NULL,
	"requested_by_id" text NOT NULL,
	"agent_run_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"phase" text DEFAULT 'queued' NOT NULL,
	"verdict" text,
	"summary" text,
	"confidence" real,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "review_analysis_stage_uidx" ON "review_analysis" USING btree ("mission_id","model","phase");--> statement-breakpoint
CREATE INDEX "review_analysis_mission_idx" ON "review_analysis" USING btree ("mission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_finding_fingerprint_uidx" ON "review_finding" USING btree ("mission_id","fingerprint");--> statement-breakpoint
CREATE INDEX "review_finding_mission_idx" ON "review_finding" USING btree ("mission_id");--> statement-breakpoint
CREATE INDEX "review_mission_team_status_idx" ON "review_mission" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "review_mission_issue_idx" ON "review_mission" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "review_mission_pull_idx" ON "review_mission" USING btree ("pull_request_url","head_sha");--> statement-breakpoint
CREATE INDEX "review_mission_run_idx" ON "review_mission" USING btree ("agent_run_id");