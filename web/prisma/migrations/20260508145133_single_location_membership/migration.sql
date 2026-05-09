/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `FirmLocationMember` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "FirmLocationMember_firmLocationId_userId_key";

-- DropIndex
DROP INDEX "FirmLocationMember_userId_idx";

-- CreateIndex
CREATE INDEX "FirmLocationMember_firmLocationId_idx" ON "FirmLocationMember"("firmLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmLocationMember_userId_key" ON "FirmLocationMember"("userId");
