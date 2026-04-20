-- CreateEnum
CREATE TYPE "ReportColumnType" AS ENUM ('TEXT', 'NUMBER', 'CURRENCY', 'PERCENT', 'DATE');

-- CreateTable
CREATE TABLE "ReportTable" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportColumn" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "ReportColumnType" NOT NULL DEFAULT 'TEXT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRow" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportTable_slug_key" ON "ReportTable"("slug");

-- CreateIndex
CREATE INDEX "ReportColumn_tableId_sortOrder_idx" ON "ReportColumn"("tableId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReportColumn_tableId_key_key" ON "ReportColumn"("tableId", "key");

-- CreateIndex
CREATE INDEX "ReportRow_tableId_sortOrder_idx" ON "ReportRow"("tableId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRow_tableId_rowKey_key" ON "ReportRow"("tableId", "rowKey");

-- AddForeignKey
ALTER TABLE "ReportColumn" ADD CONSTRAINT "ReportColumn_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "ReportTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRow" ADD CONSTRAINT "ReportRow_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "ReportTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
