-- AlterTable
ALTER TABLE "CrmLeadPipeline" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedContactId" TEXT,
ADD COLUMN     "convertedMatterId" TEXT,
ADD COLUMN     "raSignedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "primaryContactId" TEXT;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadPipeline" ADD CONSTRAINT "CrmLeadPipeline_convertedContactId_fkey" FOREIGN KEY ("convertedContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadPipeline" ADD CONSTRAINT "CrmLeadPipeline_convertedMatterId_fkey" FOREIGN KEY ("convertedMatterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
