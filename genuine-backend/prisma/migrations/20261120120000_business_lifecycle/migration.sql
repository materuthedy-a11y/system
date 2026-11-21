-- Business lifecycle: soft-delete/retention fields on Business,
-- anonymization marker on User.

ALTER TABLE "Business"
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletionScheduledAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT;

ALTER TABLE "User"
  ADD COLUMN "anonymizedAt" TIMESTAMP(3);

CREATE INDEX "Business_deletionScheduledAt_idx" ON "Business"("deletionScheduledAt");
