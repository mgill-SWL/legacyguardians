-- CreateEnum
CREATE TYPE "FinancialSourceSystem" AS ENUM ('COSMOLEX', 'MANUAL', 'IMPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingAccountType" AS ENUM ('TRUST', 'OPERATING', 'ACCOUNTS_RECEIVABLE', 'REVENUE', 'EXPENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "MatterFinancialEventType" AS ENUM ('BILLED', 'PAYMENT_RECEIVED', 'TRUST_DEPOSIT', 'TRUST_APPLIED', 'OPERATING_DEPOSIT', 'REFUND', 'WRITE_OFF', 'TRANSFER');

-- CreateEnum
CREATE TYPE "FinancialAttributionRole" AS ENUM ('LEAD_ATTORNEY', 'TIMEKEEPER', 'INTAKE_OWNER', 'ORIGINATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "KpiImportReportType" AS ENUM ('COLLECTIONS_BY_TIMEKEEPER', 'BILLINGS_BY_TIMEKEEPER', 'TRUST_RECEIPTS_JOURNAL', 'TRUST_DISBURSEMENTS_JOURNAL', 'INVOICE_PAYMENT_ALLOCATIONS', 'OPERATING_RETAINER_BY_MATTER');

-- CreateEnum
CREATE TYPE "KpiImportBatchStatus" AS ENUM ('PENDING', 'IMPORTED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "cosmolexTimekeeperName" TEXT;

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "BillingAccountType" NOT NULL,
    "sourceSystem" "FinancialSourceSystem" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KpiImportBatch" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "sourceSystem" "FinancialSourceSystem" NOT NULL DEFAULT 'COSMOLEX',
    "reportType" "KpiImportReportType" NOT NULL,
    "status" "KpiImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "rangeStart" TIMESTAMP(3),
    "rangeEnd" TIMESTAMP(3),
    "sourceFilename" TEXT,
    "sourceFileUrl" TEXT,
    "errorMessage" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KpiImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterFinancialEvent" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT,
    "eventType" "MatterFinancialEventType" NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sourceSystem" "FinancialSourceSystem" NOT NULL DEFAULT 'IMPORT',
    "sourceReference" TEXT,
    "sourceInvoiceNumber" TEXT,
    "sourceMatterFileNumber" TEXT,
    "sourceClientName" TEXT,
    "sourceMatterName" TEXT,
    "notes" TEXT,
    "fromAccountId" TEXT,
    "toAccountId" TEXT,
    "importBatchId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterFinancialEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterFinancialAttribution" (
    "id" TEXT NOT NULL,
    "financialEventId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "FinancialAttributionRole" NOT NULL DEFAULT 'TIMEKEEPER',
    "amountCents" INTEGER NOT NULL,
    "percentageBps" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterFinancialAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_firmId_name_key" ON "BillingAccount"("firmId", "name");

-- CreateIndex
CREATE INDEX "BillingAccount_firmId_accountType_active_idx" ON "BillingAccount"("firmId", "accountType", "active");

-- CreateIndex
CREATE INDEX "KpiImportBatch_firmId_reportType_createdAt_idx" ON "KpiImportBatch"("firmId", "reportType", "createdAt");

-- CreateIndex
CREATE INDEX "KpiImportBatch_status_idx" ON "KpiImportBatch"("status");

-- CreateIndex
CREATE INDEX "MatterFinancialEvent_firmId_eventType_eventDate_idx" ON "MatterFinancialEvent"("firmId", "eventType", "eventDate");

-- CreateIndex
CREATE INDEX "MatterFinancialEvent_matterId_eventDate_idx" ON "MatterFinancialEvent"("matterId", "eventDate");

-- CreateIndex
CREATE INDEX "MatterFinancialEvent_importBatchId_idx" ON "MatterFinancialEvent"("importBatchId");

-- CreateIndex
CREATE INDEX "MatterFinancialEvent_sourceInvoiceNumber_idx" ON "MatterFinancialEvent"("sourceInvoiceNumber");

-- CreateIndex
CREATE INDEX "MatterFinancialAttribution_financialEventId_idx" ON "MatterFinancialAttribution"("financialEventId");

-- CreateIndex
CREATE INDEX "MatterFinancialAttribution_userId_idx" ON "MatterFinancialAttribution"("userId");

-- CreateIndex
CREATE INDEX "MatterFinancialAttribution_displayName_idx" ON "MatterFinancialAttribution"("displayName");

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiImportBatch" ADD CONSTRAINT "KpiImportBatch_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KpiImportBatch" ADD CONSTRAINT "KpiImportBatch_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialEvent" ADD CONSTRAINT "MatterFinancialEvent_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialEvent" ADD CONSTRAINT "MatterFinancialEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialEvent" ADD CONSTRAINT "MatterFinancialEvent_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialEvent" ADD CONSTRAINT "MatterFinancialEvent_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialEvent" ADD CONSTRAINT "MatterFinancialEvent_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "KpiImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialEvent" ADD CONSTRAINT "MatterFinancialEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialAttribution" ADD CONSTRAINT "MatterFinancialAttribution_financialEventId_fkey" FOREIGN KEY ("financialEventId") REFERENCES "MatterFinancialEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatterFinancialAttribution" ADD CONSTRAINT "MatterFinancialAttribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
