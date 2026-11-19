ALTER TABLE "team" ADD COLUMN "member_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: Better Auth 1.7 keeps member_count from here on; existing teams
-- start from the rows they already have, the same count the plugin's
-- syncTeamMemberCount takes.
UPDATE "team" SET "member_count" = "counts"."n"
FROM (SELECT "team_id", count(*)::integer AS "n" FROM "team_member" GROUP BY "team_id") AS "counts"
WHERE "counts"."team_id" = "team"."id";--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "membership_key" text;--> statement-breakpoint
-- Backfill: the key Better Auth 1.7 writes on add (computeTeamMembershipKey in
-- better-auth/dist/plugins/organization/adapter.mjs): unpadded base64url of
-- SHA-256 over JSON.stringify([teamId, userId]). If a (team, user) pair was
-- ever stored twice, only its oldest row gets the key, so the unique
-- constraint below cannot fail; the other rows keep a null key and nothing is
-- deleted.
UPDATE "team_member"
SET "membership_key" = rtrim(
   translate(
      encode(
         sha256(convert_to('[' || to_json("team_id")::text || ',' || to_json("user_id")::text || ']', 'UTF8')),
         'base64'
      ),
      '+/',
      '-_'
   ),
   '='
)
WHERE "id" IN (
   SELECT DISTINCT ON ("team_id", "user_id") "id"
   FROM "team_member"
   ORDER BY "team_id", "user_id", "created_at" NULLS LAST, "id"
);--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_membership_key_unique" UNIQUE("membership_key");
