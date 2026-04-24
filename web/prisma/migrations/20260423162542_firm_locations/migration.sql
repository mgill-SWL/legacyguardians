-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeLocationId" TEXT;

-- CreateTable
CREATE TABLE "FirmLocation" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "phone" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmLocation_firmId_sortOrder_idx" ON "FirmLocation"("firmId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FirmLocation_firmId_slug_key" ON "FirmLocation"("firmId", "slug");

-- AddForeignKey
ALTER TABLE "FirmLocation" ADD CONSTRAINT "FirmLocation_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_activeLocationId_fkey" FOREIGN KEY ("activeLocationId") REFERENCES "FirmLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
