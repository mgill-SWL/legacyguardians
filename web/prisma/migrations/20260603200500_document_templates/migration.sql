CREATE TYPE "DocumentTemplateKind" AS ENUM (
  'REPRESENTATION_AGREEMENT',
  'HR_DOCUMENT',
  'CONSENT',
  'AUTHORIZATION',
  'ACKNOWLEDGEMENT'
);

CREATE TABLE "DocumentTemplate" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "DocumentTemplateKind" NOT NULL,
  "description" TEXT,
  "sourceFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentTemplate_firmId_key_key" ON "DocumentTemplate"("firmId", "key");
CREATE INDEX "DocumentTemplate_firmId_kind_idx" ON "DocumentTemplate"("firmId", "kind");
CREATE INDEX "DocumentTemplate_firmId_active_idx" ON "DocumentTemplate"("firmId", "active");

ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
