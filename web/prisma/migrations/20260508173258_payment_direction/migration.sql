-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "direction" "PaymentDirection" NOT NULL DEFAULT 'INFLOW';

-- CreateIndex
CREATE INDEX "Payment_firmId_direction_receivedAt_idx" ON "Payment"("firmId", "direction", "receivedAt");
