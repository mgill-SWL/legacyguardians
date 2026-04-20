-- CreateEnum
CREATE TYPE "FeeFeatureType" AS ENUM ('MONEY', 'TEXT', 'BOOLEAN', 'NUMBER');

-- CreateTable
CREATE TABLE "FeeFeature" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "group" TEXT,
    "type" "FeeFeatureType" NOT NULL DEFAULT 'MONEY',
    "moneyCents" INTEGER DEFAULT 0,
    "textValue" TEXT,
    "boolValue" BOOLEAN,
    "numberValue" DOUBLE PRECISION,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeFeature_key_key" ON "FeeFeature"("key");
