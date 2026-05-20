-- AlterTable
ALTER TABLE "OperatingCheck" ADD COLUMN     "printedAt" TIMESTAMP(3),
ADD COLUMN     "printedByUserId" TEXT,
ADD COLUMN     "toBePrinted" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "OperatingCheck" ADD CONSTRAINT "OperatingCheck_printedByUserId_fkey" FOREIGN KEY ("printedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
