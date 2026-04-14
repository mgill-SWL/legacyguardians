-- CreateEnum
CREATE TYPE "CrmVerificationPurpose" AS ENUM ('REGISTRATION', 'WATCH_ROOM');

-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CrmRegistration" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CrmVerification" (
    "id" TEXT NOT NULL,
    "purpose" "CrmVerificationPurpose" NOT NULL,
    "contactId" TEXT NOT NULL,
    "registrationId" TEXT,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmVerification_contactId_idx" ON "CrmVerification"("contactId");

-- CreateIndex
CREATE INDEX "CrmVerification_registrationId_idx" ON "CrmVerification"("registrationId");

-- CreateIndex
CREATE INDEX "CrmVerification_purpose_expiresAt_idx" ON "CrmVerification"("purpose", "expiresAt");

-- AddForeignKey
ALTER TABLE "CrmVerification" ADD CONSTRAINT "CrmVerification_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmVerification" ADD CONSTRAINT "CrmVerification_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "CrmRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
