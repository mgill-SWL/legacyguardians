-- CreateEnum
CREATE TYPE "SigningProvider" AS ENUM ('DOCUMENSO');

-- CreateEnum
CREATE TYPE "SigningPacketStatus" AS ENUM ('DRAFT', 'SENT', 'COMPLETED', 'REJECTED', 'ERROR');

-- CreateTable
CREATE TABLE "SigningPacket" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "matterId" TEXT,
    "templateId" TEXT,
    "provider" "SigningProvider" NOT NULL DEFAULT 'DOCUMENSO',
    "status" "SigningPacketStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "providerEnvelopeId" TEXT,
    "providerStatus" TEXT,
    "sourceFileName" TEXT,
    "recipientsJson" JSONB NOT NULL,
    "signingUrlsJson" JSONB,
    "providerResponseJson" JSONB,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SigningPacket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SigningPacket_firmId_provider_status_idx" ON "SigningPacket"("firmId", "provider", "status");

-- CreateIndex
CREATE INDEX "SigningPacket_firmId_providerEnvelopeId_idx" ON "SigningPacket"("firmId", "providerEnvelopeId");

-- CreateIndex
CREATE INDEX "SigningPacket_matterId_idx" ON "SigningPacket"("matterId");

-- CreateIndex
CREATE INDEX "SigningPacket_templateId_idx" ON "SigningPacket"("templateId");

-- AddForeignKey
ALTER TABLE "SigningPacket" ADD CONSTRAINT "SigningPacket_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPacket" ADD CONSTRAINT "SigningPacket_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPacket" ADD CONSTRAINT "SigningPacket_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SigningPacket" ADD CONSTRAINT "SigningPacket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
