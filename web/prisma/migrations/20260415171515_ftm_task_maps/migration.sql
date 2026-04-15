-- CreateTable
CREATE TABLE "FtmMap" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FtmMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FtmStep" (
    "id" TEXT NOT NULL,
    "mapId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "howOwnerUserId" TEXT,
    "ensureOwnerUserId" TEXT,
    "doerUserId" TEXT,
    "doerRole" TEXT,
    "howToMd" TEXT,
    "doneWhenMd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FtmStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FtmStep_mapId_sortOrder_idx" ON "FtmStep"("mapId", "sortOrder");

-- AddForeignKey
ALTER TABLE "FtmStep" ADD CONSTRAINT "FtmStep_mapId_fkey" FOREIGN KEY ("mapId") REFERENCES "FtmMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtmStep" ADD CONSTRAINT "FtmStep_howOwnerUserId_fkey" FOREIGN KEY ("howOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtmStep" ADD CONSTRAINT "FtmStep_ensureOwnerUserId_fkey" FOREIGN KEY ("ensureOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FtmStep" ADD CONSTRAINT "FtmStep_doerUserId_fkey" FOREIGN KEY ("doerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
