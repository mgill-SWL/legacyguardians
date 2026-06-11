ALTER TABLE "CrmPrequalSubmission" ADD COLUMN "leadId" TEXT;

ALTER TABLE "CrmPrequalSubmission" ADD CONSTRAINT "CrmPrequalSubmission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLeadPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CrmPrequalSubmission_leadId_createdAt_idx" ON "CrmPrequalSubmission"("leadId", "createdAt");
