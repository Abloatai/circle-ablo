ALTER TABLE "agent_message" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "cycle" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "document_folder" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "initiative" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "label" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "project_label" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "project_milestone" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "project_resource" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "project_update" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "saved_view" ADD COLUMN "ablo_tenant_id" text;--> statement-breakpoint
ALTER TABLE "workflow_state" ADD COLUMN "ablo_tenant_id" text;