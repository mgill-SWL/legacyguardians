CREATE TABLE "RepresentationAgreementDraft" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceFileName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "mergeData" JSONB NOT NULL,
    "missingTokens" TEXT[] NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepresentationAgreementDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RepresentationAgreementDraft_firmId_createdAt_idx" ON "RepresentationAgreementDraft"("firmId", "createdAt");
CREATE INDEX "RepresentationAgreementDraft_leadId_createdAt_idx" ON "RepresentationAgreementDraft"("leadId", "createdAt");
CREATE INDEX "RepresentationAgreementDraft_templateId_idx" ON "RepresentationAgreementDraft"("templateId");
CREATE INDEX "RepresentationAgreementDraft_status_idx" ON "RepresentationAgreementDraft"("status");

ALTER TABLE "RepresentationAgreementDraft" ADD CONSTRAINT "RepresentationAgreementDraft_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepresentationAgreementDraft" ADD CONSTRAINT "RepresentationAgreementDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLeadPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepresentationAgreementDraft" ADD CONSTRAINT "RepresentationAgreementDraft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RepresentationAgreementDraft" ADD CONSTRAINT "RepresentationAgreementDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
