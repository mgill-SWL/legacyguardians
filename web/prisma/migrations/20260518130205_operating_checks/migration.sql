-- CreateEnum
CREATE TYPE "OperatingCheckStatus" AS ENUM ('DRAFT', 'ISSUED', 'CLEARED', 'VOID');

-- CreateTable
CREATE TABLE "FinancialAccountCheckSequence" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccountCheckSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingCheck" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "status" "OperatingCheckStatus" NOT NULL DEFAULT 'DRAFT',
    "checkNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "payeeName" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "memo" TEXT,
    "clearedRawTransactionId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccountCheckSequence_financialAccountId_key" ON "FinancialAccountCheckSequence"("financialAccountId");

-- CreateIndex
CREATE INDEX "FinancialAccountCheckSequence_firmId_idx" ON "FinancialAccountCheckSequence"("firmId");

-- CreateIndex
CREATE INDEX "OperatingCheck_firmId_financialAccountId_issueDate_idx" ON "OperatingCheck"("firmId", "financialAccountId", "issueDate");

-- CreateIndex
CREATE INDEX "OperatingCheck_status_issueDate_idx" ON "OperatingCheck"("status", "issueDate");

-- CreateIndex
CREATE INDEX "OperatingCheck_clearedRawTransactionId_idx" ON "OperatingCheck"("clearedRawTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatingCheck_financialAccountId_checkNumber_key" ON "OperatingCheck"("financialAccountId", "checkNumber");

-- AddForeignKey
ALTER TABLE "FinancialAccountCheckSequence" ADD CONSTRAINT "FinancialAccountCheckSequence_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAccountCheckSequence" ADD CONSTRAINT "FinancialAccountCheckSequence_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingCheck" ADD CONSTRAINT "OperatingCheck_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingCheck" ADD CONSTRAINT "OperatingCheck_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingCheck" ADD CONSTRAINT "OperatingCheck_clearedRawTransactionId_fkey" FOREIGN KEY ("clearedRawTransactionId") REFERENCES "RawFinancialTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatingCheck" ADD CONSTRAINT "OperatingCheck_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
