/*
  Warnings:

  - You are about to alter the column `slug` on the `Firm` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(4)`.

*/
-- CreateEnum
CREATE TYPE "TimeEntryPricingMode" AS ENUM ('HOURLY', 'FLAT');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('DRAFT', 'INVOICED', 'VOID');

-- CreateEnum
CREATE TYPE "FirmOwnerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RevenueSplitRecipient" AS ENUM ('LEGACY_GUARDIANS_MSO');

-- Ensure existing slugs fit the new max length before type cast.
-- (Longer slugs are truncated; callers should treat the slug as user-controlled going forward.)
UPDATE "Firm" SET "slug" = upper(left("slug", 4)) WHERE length("slug") > 4;

-- AlterTable
ALTER TABLE "Firm" ALTER COLUMN "slug" SET DATA TYPE VARCHAR(4);

-- CreateTable
CREATE TABLE "FirmOwner" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "barNumber" TEXT,
    "barState" TEXT,
    "email" TEXT,
    "status" "FirmOwnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmRevenueSplit" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "recipient" "RevenueSplitRecipient" NOT NULL,
    "percentBps" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmRevenueSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmOwnershipStake" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmOwnershipStake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT NOT NULL,
    "timekeeperId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "narrative" TEXT NOT NULL,
    "pricingMode" "TimeEntryPricingMode" NOT NULL DEFAULT 'HOURLY',
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "hourlyRateCents" INTEGER,
    "flatAmountCents" INTEGER,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "invoiceLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmOwner_firmId_status_idx" ON "FirmOwner"("firmId", "status");

-- CreateIndex
CREATE INDEX "FirmOwner_firmId_fullName_idx" ON "FirmOwner"("firmId", "fullName");

-- CreateIndex
CREATE INDEX "FirmRevenueSplit_firmId_recipient_effectiveFrom_idx" ON "FirmRevenueSplit"("firmId", "recipient", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FirmRevenueSplit_firmId_effectiveTo_idx" ON "FirmRevenueSplit"("firmId", "effectiveTo");

-- CreateIndex
CREATE INDEX "FirmOwnershipStake_firmId_effectiveFrom_idx" ON "FirmOwnershipStake"("firmId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FirmOwnershipStake_ownerId_effectiveFrom_idx" ON "FirmOwnershipStake"("ownerId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "FirmOwnershipStake_firmId_effectiveTo_idx" ON "FirmOwnershipStake"("firmId", "effectiveTo");

-- CreateIndex
CREATE INDEX "TimeEntry_firmId_workDate_idx" ON "TimeEntry"("firmId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_matterId_workDate_idx" ON "TimeEntry"("matterId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_timekeeperId_workDate_idx" ON "TimeEntry"("timekeeperId", "workDate");

-- CreateIndex
CREATE INDEX "TimeEntry_status_workDate_idx" ON "TimeEntry"("status", "workDate");

-- AddForeignKey
ALTER TABLE "FirmOwner" ADD CONSTRAINT "FirmOwner_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmRevenueSplit" ADD CONSTRAINT "FirmRevenueSplit_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmOwnershipStake" ADD CONSTRAINT "FirmOwnershipStake_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmOwnershipStake" ADD CONSTRAINT "FirmOwnershipStake_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "FirmOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_timekeeperId_fkey" FOREIGN KEY ("timekeeperId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
