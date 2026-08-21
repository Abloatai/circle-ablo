CREATE TABLE "github_installation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_id" bigint NOT NULL,
	"account_login" text NOT NULL,
	"account_type" text NOT NULL,
	"repository_selection" text NOT NULL,
	"created_by" text NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repository" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"github_repository_id" bigint NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"html_url" text NOT NULL,
	"private" boolean NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"team_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_webhook_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_installation" ADD CONSTRAINT "github_installation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repository" ADD CONSTRAINT "github_repository_installation_id_github_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repository" ADD CONSTRAINT "github_repository_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_installation_installation_uidx" ON "github_installation" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "github_installation_org_idx" ON "github_installation" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_repository_installation_repo_uidx" ON "github_repository" USING btree ("installation_id","github_repository_id");--> statement-breakpoint
CREATE INDEX "github_repository_team_idx" ON "github_repository" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "github_repository_full_name_idx" ON "github_repository" USING btree ("full_name");