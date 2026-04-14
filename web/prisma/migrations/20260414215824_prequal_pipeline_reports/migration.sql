-- CreateEnum
CREATE TYPE "CrmAppointmentStatus" AS ENUM ('SCHEDULED', 'SHOWED', 'NO_SHOW', 'CANCELED', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "CrmPrequalSubmission" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "registrationId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "estatePlanningStage" TEXT,
    "primaryConcern" TEXT,
    "docsInPlace" TEXT[],
    "estateWorthBand" TEXT,
    "investReady" BOOLEAN,
    "readyToStart" TEXT,
    "additionalNotes" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmPrequalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadPipeline" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "additionalNotes" TEXT,
    "intakeCallAttempted" BOOLEAN NOT NULL DEFAULT false,
    "intakeCallAttemptedAt" TIMESTAMP(3),
    "appt1Scheduled" BOOLEAN NOT NULL DEFAULT false,
    "appt1At" TIMESTAMP(3),
    "appt1Status" "CrmAppointmentStatus",
    "leadQualityScore" INTEGER,
    "appt2Scheduled" BOOLEAN NOT NULL DEFAULT false,
    "appt2At" TIMESTAMP(3),
    "appt2Status" "CrmAppointmentStatus",
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "cashCollectedCents" INTEGER NOT NULL DEFAULT 0,
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLeadPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmDailySpend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmDailySpend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmPrequalSubmission_campaignId_createdAt_idx" ON "CrmPrequalSubmission"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmPrequalSubmission_contactId_createdAt_idx" ON "CrmPrequalSubmission"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmLeadPipeline_campaignId_dateAdded_idx" ON "CrmLeadPipeline"("campaignId", "dateAdded");

-- CreateIndex
CREATE UNIQUE INDEX "CrmLeadPipeline_contactId_campaignId_key" ON "CrmLeadPipeline"("contactId", "campaignId");

-- CreateIndex
CREATE INDEX "CrmDailySpend_campaignId_day_idx" ON "CrmDailySpend"("campaignId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "CrmDailySpend_campaignId_day_key" ON "CrmDailySpend"("campaignId", "day");

-- AddForeignKey
ALTER TABLE "CrmPrequalSubmission" ADD CONSTRAINT "CrmPrequalSubmission_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPrequalSubmission" ADD CONSTRAINT "CrmPrequalSubmission_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPrequalSubmission" ADD CONSTRAINT "CrmPrequalSubmission_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "CrmRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadPipeline" ADD CONSTRAINT "CrmLeadPipeline_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadPipeline" ADD CONSTRAINT "CrmLeadPipeline_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmDailySpend" ADD CONSTRAINT "CrmDailySpend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CrmCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
