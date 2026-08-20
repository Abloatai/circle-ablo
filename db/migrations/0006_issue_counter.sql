CREATE TABLE "issue_counter" (
	"team_id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"next" integer DEFAULT 1 NOT NULL
);
