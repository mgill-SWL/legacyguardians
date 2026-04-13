-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'CRM_AGENT_PH';
ALTER TYPE "UserRole" ADD VALUE 'CRM_AGENT_US';

-- CreateTable
CREATE TABLE "RingCentralConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rcUserId" TEXT,
    "rcExtensionId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RingCentralConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RingCentralConnection_userId_key" ON "RingCentralConnection"("userId");

-- AddForeignKey
ALTER TABLE "RingCentralConnection" ADD CONSTRAINT "RingCentralConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
