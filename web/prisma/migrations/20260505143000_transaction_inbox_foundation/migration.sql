-- Draft migration for transaction inbox foundation.
-- Not yet validated against prisma generate/migrate.

CREATE TYPE "FinancialFeedSource" AS ENUM ('BANK_CSV', 'CARD_CSV', 'MANUAL', 'COSMOLEX', 'OTHER');
CREATE TYPE "FinancialAccountKind" AS ENUM ('OPERATING_BANK', 'TRUST_BANK', 'MONEY_MARKET', 'CREDIT_CARD', 'LIABILITY', 'CLEARING', 'OTHER');
CREATE TYPE "RawTransactionDirection" AS ENUM ('INFLOW', 'OUTFLOW');
CREATE TYPE "TransactionReviewStatus" AS ENUM ('UNREVIEWED', 'NEEDS_INFO', 'MATCHED', 'IGNORED');
CREATE TYPE "FinancialClassificationType" AS ENUM ('TRUST_DEPOSIT', 'TRUST_TO_OPERATING_TRANSFER', 'TRUST_MATTER_TRANSFER', 'OPERATING_RETAINER_DEPOSIT', 'OPERATING_RETAINER_APPLICATION', 'DIRECT_FEE_PAYMENT', 'REIMBURSED_COST_PAYMENT', 'REFUND', 'MERCHANT_FEE', 'OWNER_TRANSFER', 'EXPENSE', 'IGNORE');

CREATE TABLE "FinancialAccount" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "FinancialAccountKind" NOT NULL,
  "institutionName" TEXT,
  "last4" TEXT,
  "externalId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialAccount_firmId_name_key" ON "FinancialAccount"("firmId", "name");
CREATE INDEX "FinancialAccount_firmId_kind_active_idx" ON "FinancialAccount"("firmId", "kind", "active");
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FinancialImportBatch" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "source" "FinancialFeedSource" NOT NULL,
  "accountId" TEXT,
  "sourceFilename" TEXT,
  "sourceFileUrl" TEXT,
  "importedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinancialImportBatch_firmId_source_createdAt_idx" ON "FinancialImportBatch"("firmId", "source", "createdAt");
ALTER TABLE "FinancialImportBatch" ADD CONSTRAINT "FinancialImportBatch_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialImportBatch" ADD CONSTRAINT "FinancialImportBatch_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialImportBatch" ADD CONSTRAINT "FinancialImportBatch_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RawFinancialTransaction" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "accountId" TEXT,
  "importBatchId" TEXT,
  "source" "FinancialFeedSource" NOT NULL,
  "transactionDate" TIMESTAMP(3) NOT NULL,
  "postedDate" TIMESTAMP(3),
  "amountCents" INTEGER NOT NULL,
  "direction" "RawTransactionDirection" NOT NULL,
  "payee" TEXT,
  "description" TEXT NOT NULL,
  "memo" TEXT,
  "externalReference" TEXT,
  "rawData" JSONB NOT NULL,
  "dedupeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RawFinancialTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RawFinancialTransaction_firmId_dedupeHash_key" ON "RawFinancialTransaction"("firmId", "dedupeHash");
CREATE INDEX "RawFinancialTransaction_firmId_transactionDate_idx" ON "RawFinancialTransaction"("firmId", "transactionDate");
CREATE INDEX "RawFinancialTransaction_accountId_transactionDate_idx" ON "RawFinancialTransaction"("accountId", "transactionDate");
CREATE INDEX "RawFinancialTransaction_importBatchId_idx" ON "RawFinancialTransaction"("importBatchId");
ALTER TABLE "RawFinancialTransaction" ADD CONSTRAINT "RawFinancialTransaction_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RawFinancialTransaction" ADD CONSTRAINT "RawFinancialTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RawFinancialTransaction" ADD CONSTRAINT "RawFinancialTransaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "FinancialImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TransactionReviewItem" (
  "id" TEXT NOT NULL,
  "rawTransactionId" TEXT NOT NULL,
  "status" "TransactionReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "suggestedCategory" "FinancialClassificationType",
  "reviewNotes" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TransactionReviewItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TransactionReviewItem_status_createdAt_idx" ON "TransactionReviewItem"("status", "createdAt");
CREATE INDEX "TransactionReviewItem_rawTransactionId_idx" ON "TransactionReviewItem"("rawTransactionId");
ALTER TABLE "TransactionReviewItem" ADD CONSTRAINT "TransactionReviewItem_rawTransactionId_fkey" FOREIGN KEY ("rawTransactionId") REFERENCES "RawFinancialTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionReviewItem" ADD CONSTRAINT "TransactionReviewItem_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "FinancialClassification" (
  "id" TEXT NOT NULL,
  "rawTransactionId" TEXT NOT NULL,
  "classificationType" "FinancialClassificationType" NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "matterId" TEXT,
  "contactId" TEXT,
  "invoiceNumber" TEXT,
  "notes" TEXT,
  "confidence" INTEGER,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialClassification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FinancialClassification_classificationType_effectiveDate_idx" ON "FinancialClassification"("classificationType", "effectiveDate");
CREATE INDEX "FinancialClassification_matterId_idx" ON "FinancialClassification"("matterId");
CREATE INDEX "FinancialClassification_invoiceNumber_idx" ON "FinancialClassification"("invoiceNumber");
CREATE INDEX "FinancialClassification_rawTransactionId_idx" ON "FinancialClassification"("rawTransactionId");
ALTER TABLE "FinancialClassification" ADD CONSTRAINT "FinancialClassification_rawTransactionId_fkey" FOREIGN KEY ("rawTransactionId") REFERENCES "RawFinancialTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialClassification" ADD CONSTRAINT "FinancialClassification_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialClassification" ADD CONSTRAINT "FinancialClassification_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialClassification" ADD CONSTRAINT "FinancialClassification_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
