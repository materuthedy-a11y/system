ALTER TABLE "FeedbackSubmission"
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "assignedToId" TEXT;

CREATE INDEX "FeedbackSubmission_businessId_assignedToId_status_idx"
ON "FeedbackSubmission"("businessId", "assignedToId", "status");

ALTER TABLE "FeedbackSubmission"
ADD CONSTRAINT "FeedbackSubmission_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
