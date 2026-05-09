/*
  Warnings:

  - A unique constraint covering the columns `[firmId,key]` on the table `MessageTemplate` will be added. If there are existing duplicate values, this will fail.
  - Made the column `firmId` on table `MessageTemplate` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `firmId` to the `ScheduledJob` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ScheduledJobStatus" ADD VALUE 'IN_PROGRESS';

-- DropForeignKey
ALTER TABLE "MessageTemplate" DROP CONSTRAINT "MessageTemplate_firmId_fkey";

-- DropIndex
DROP INDEX "MessageTemplate_key_key";

-- AlterTable
ALTER TABLE "MessageTemplate" ALTER COLUMN "firmId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ScheduledJob" ADD COLUMN     "firmId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "MessageTemplate_firmId_channel_idx" ON "MessageTemplate"("firmId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_firmId_key_key" ON "MessageTemplate"("firmId", "key");

-- CreateIndex
CREATE INDEX "ScheduledJob_firmId_status_runAt_idx" ON "ScheduledJob"("firmId", "status", "runAt");

-- AddForeignKey
ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplate" ADD CONSTRAINT "MessageTemplate_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
