-- AlterTable
ALTER TABLE "Matter" ADD COLUMN     "primaryLocationId" TEXT;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "locationId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultLocationId" TEXT;

-- CreateTable
CREATE TABLE "FirmLocationMember" (
    "id" TEXT NOT NULL,
    "firmLocationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FirmMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmLocationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmLocationMember_userId_idx" ON "FirmLocationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmLocationMember_firmLocationId_userId_key" ON "FirmLocationMember"("firmLocationId", "userId");

-- CreateIndex
CREATE INDEX "Matter_firmId_primaryLocationId_idx" ON "Matter"("firmId", "primaryLocationId");

-- CreateIndex
CREATE INDEX "TimeEntry_firmId_locationId_workDate_idx" ON "TimeEntry"("firmId", "locationId", "workDate");

-- AddForeignKey
ALTER TABLE "FirmLocationMember" ADD CONSTRAINT "FirmLocationMember_firmLocationId_fkey" FOREIGN KEY ("firmLocationId") REFERENCES "FirmLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmLocationMember" ADD CONSTRAINT "FirmLocationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "FirmLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_primaryLocationId_fkey" FOREIGN KEY ("primaryLocationId") REFERENCES "FirmLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "FirmLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
