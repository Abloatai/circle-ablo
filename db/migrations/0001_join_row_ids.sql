ALTER TABLE "issue_label" DROP CONSTRAINT "issue_label_issue_id_label_id_pk";--> statement-breakpoint
ALTER TABLE "project_label" DROP CONSTRAINT "project_label_project_id_label_id_pk";--> statement-breakpoint
ALTER TABLE "issue_label" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_label" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_label" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "issue_label" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_label" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_label" ADD COLUMN "id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "project_label" ADD COLUMN "organization_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "project_label" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "project_label" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "project_label" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_label_idx" ON "issue_label" USING btree ("issue_id","label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_label_idx" ON "project_label" USING btree ("project_id","label_id");