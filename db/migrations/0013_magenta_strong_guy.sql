CREATE TABLE "favorite" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"ablo_tenant_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "favorite_user_entity_idx" ON "favorite" USING btree ("user_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "favorite_user_idx" ON "favorite" USING btree ("user_id");