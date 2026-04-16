-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "estimatedValueCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "primaryEmail" TEXT,
ADD COLUMN     "primaryPhone" TEXT;
