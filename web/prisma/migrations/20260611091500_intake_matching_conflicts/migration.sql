CREATE TYPE "IntakeSourceType" AS ENUM ('MANUAL', 'INBOUND_TEXT', 'INBOUND_CALL', 'FORM_FILL', 'WEBINAR', 'REGISTRATION', 'IMPORT');
CREATE TYPE "IntakeMatchConfidence" AS ENUM ('NONE', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "IntakeResolutionStatus" AS ENUM ('UNREVIEWED', 'AUTO_ATTACHED', 'REVIEW_REQUIRED', 'RESOLVED');
CREATE TYPE "DuplicateReviewStatus" AS ENUM ('NONE', 'POSSIBLE_DUPLICATE', 'DUPLICATE_CONFIRMED', 'NOT_DUPLICATE');
CREATE TYPE "ConflictCheckStatus" AS ENUM ('NOT_STARTED', 'REVIEW_REQUIRED', 'CLEARED', 'CONFLICT_IDENTIFIED', 'WAIVED');

ALTER TABLE "CrmLeadPipeline"
ADD COLUMN "sourceType" "IntakeSourceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "duplicateReviewStatus" "DuplicateReviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN "duplicateReviewNotes" TEXT,
ADD COLUMN "conflictCheckStatus" "ConflictCheckStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
ADD COLUMN "conflictCheckNotes" TEXT,
ADD COLUMN "conflictCheckUpdatedAt" TIMESTAMP(3);

ALTER TABLE "CrmMessageThread"
ADD COLUMN "leadId" TEXT,
ADD COLUMN "intakeResolutionStatus" "IntakeResolutionStatus" NOT NULL DEFAULT 'UNREVIEWED',
ADD COLUMN "matchConfidence" "IntakeMatchConfidence" NOT NULL DEFAULT 'NONE',
ADD COLUMN "matchSummary" TEXT,
ADD COLUMN "needsConflictCheck" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "CrmLeadPipeline_sourceType_dateAdded_idx" ON "CrmLeadPipeline"("sourceType", "dateAdded");
CREATE INDEX "CrmLeadPipeline_duplicateReviewStatus_idx" ON "CrmLeadPipeline"("duplicateReviewStatus");
CREATE INDEX "CrmLeadPipeline_conflictCheckStatus_idx" ON "CrmLeadPipeline"("conflictCheckStatus");
CREATE INDEX "CrmMessageThread_leadId_idx" ON "CrmMessageThread"("leadId");
CREATE INDEX "CrmMessageThread_intakeResolutionStatus_lastMessageAt_idx" ON "CrmMessageThread"("intakeResolutionStatus", "lastMessageAt");

ALTER TABLE "CrmMessageThread" ADD CONSTRAINT "CrmMessageThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLeadPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
