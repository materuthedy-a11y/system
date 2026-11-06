ALTER TABLE "AuditLog"
  ADD COLUMN "actorName" TEXT,
  ADD COLUMN "actorEmail" TEXT;

UPDATE "AuditLog" AS audit
SET "actorName" = concat_ws(' ', actor."firstName", actor."lastName"),
    "actorEmail" = actor."email"
FROM "User" AS actor
WHERE audit."userId" = actor."id";

ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "set_audit_actor_snapshot"() RETURNS trigger AS $$
BEGIN
  IF NEW."userId" IS NOT NULL THEN
    SELECT concat_ws(' ', actor."firstName", actor."lastName"), actor."email"
      INTO NEW."actorName", NEW."actorEmail"
      FROM "User" AS actor
      WHERE actor."id" = NEW."userId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_actor_snapshot"
BEFORE INSERT OR UPDATE OF "userId" ON "AuditLog"
FOR EACH ROW EXECUTE FUNCTION "set_audit_actor_snapshot"();

CREATE INDEX "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");
CREATE INDEX "AuditLog_businessId_action_createdAt_idx" ON "AuditLog"("businessId", "action", "createdAt");
CREATE INDEX "AuditLog_businessId_entityType_createdAt_idx" ON "AuditLog"("businessId", "entityType", "createdAt");
