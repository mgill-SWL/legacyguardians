-- Add a stable per-row content hash to journal-imported financial events so
-- re-importing the same CosmoLex file cannot double-count trust/payment events.
-- Existing rows keep NULL (Postgres unique indexes treat NULLs as distinct).
ALTER TABLE "MatterFinancialEvent" ADD COLUMN "dedupeHash" TEXT;

CREATE UNIQUE INDEX "MatterFinancialEvent_firmId_dedupeHash_key" ON "MatterFinancialEvent"("firmId", "dedupeHash");
