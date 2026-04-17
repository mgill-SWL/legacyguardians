-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "intakeSpecialistId" TEXT,
ADD COLUMN     "leadAttorneyId" TEXT;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_intakeSpecialistId_fkey" FOREIGN KEY ("intakeSpecialistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_leadAttorneyId_fkey" FOREIGN KEY ("leadAttorneyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
