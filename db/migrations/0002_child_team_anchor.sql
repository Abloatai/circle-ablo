ALTER TABLE "comment" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "issue_label" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "project_label" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "project_milestone" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "project_resource" ADD COLUMN "team_id" text;--> statement-breakpoint
ALTER TABLE "project_update" ADD COLUMN "team_id" text;