-- Practice areas / departments and multi-party matters (litigation foundation).

-- CreateEnum
CREATE TYPE "PracticeArea" AS ENUM ('ESTATE_PLANNING', 'ESTATE_ADMINISTRATION', 'TRUST_ADMINISTRATION', 'ELDER_LAW', 'FIDUCIARY_SERVICES', 'LITIGATION');

-- CreateEnum
CREATE TYPE "MatterPartyRole" AS ENUM ('CLIENT', 'CO_CLIENT', 'OPPOSING_PARTY', 'OPPOSING_COUNSEL', 'WITNESS', 'OTHER');

-- AlterTable
ALTER TABLE "Matter" ADD COLUMN "practiceArea" "PracticeArea";
ALTER TABLE "Matter" ADD COLUMN "litigationSubjectArea" "PracticeArea";

-- CreateIndex
CREATE INDEX "Matter_firmId_practiceArea_idx" ON "Matter"("firmId", "practiceArea");

-- CreateTable
CREATE TABLE "MatterContact" (
    "id" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "MatterPartyRole" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatterContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatterContact_matterId_contactId_key" ON "MatterContact"("matterId", "contactId");

-- CreateIndex
CREATE INDEX "MatterContact_matterId_idx" ON "MatterContact"("matterId");

-- CreateIndex
CREATE INDEX "MatterContact_contactId_idx" ON "MatterContact"("contactId");

-- AddForeignKey
ALTER TABLE "MatterContact" ADD CONSTRAINT "MatterContact_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterContact" ADD CONSTRAINT "MatterContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
