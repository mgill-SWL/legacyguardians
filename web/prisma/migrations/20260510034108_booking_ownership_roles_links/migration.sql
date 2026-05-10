/*
  Warnings:

  - A unique constraint covering the columns `[publicId]` on the table `AppointmentType` will be added. If there are existing duplicate values, this will fail.
  - The required column `publicId` was added to the `AppointmentType` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "FirmMemberKind" AS ENUM ('INTAKER', 'ATTORNEY', 'PARALEGAL', 'BOOKKEEPER', 'ADMIN', 'STAFF');

-- AlterTable
ALTER TABLE "AppointmentType" ADD COLUMN     "firmId" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "publicId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FirmMember" ADD COLUMN     "kind" "FirmMemberKind" NOT NULL DEFAULT 'STAFF';

-- CreateTable
CREATE TABLE "BookingLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedUses" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingLink_token_key" ON "BookingLink"("token");

-- CreateIndex
CREATE INDEX "BookingLink_typeId_enabled_idx" ON "BookingLink"("typeId", "enabled");

-- CreateIndex
CREATE INDEX "BookingLink_token_idx" ON "BookingLink"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentType_publicId_key" ON "AppointmentType"("publicId");

-- AddForeignKey
ALTER TABLE "AppointmentType" ADD CONSTRAINT "AppointmentType_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentType" ADD CONSTRAINT "AppointmentType_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLink" ADD CONSTRAINT "BookingLink_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AppointmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingLink" ADD CONSTRAINT "BookingLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
