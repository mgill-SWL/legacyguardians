ALTER TYPE "MatterTimelineEventType" ADD VALUE IF NOT EXISTS 'MATTER_FIELD_UPDATED';

CREATE TYPE "MatterFieldType" AS ENUM (
  'TEXT',
  'LONG_TEXT',
  'DATE',
  'CURRENCY',
  'NUMBER',
  'TRUE_FALSE',
  'PICKLIST',
  'MULTI_SELECT_PICKLIST',
  'USER',
  'CONTACT',
  'LOOKUP'
);

CREATE TABLE "MatterFieldDefinition" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "MatterFieldType" NOT NULL,
  "helpText" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "lookupTarget" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MatterFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatterFieldValue" (
  "id" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "fieldDefinitionId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MatterFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatterFieldDefinition_firmId_key_key" ON "MatterFieldDefinition"("firmId", "key");
CREATE INDEX "MatterFieldDefinition_firmId_active_sortOrder_idx" ON "MatterFieldDefinition"("firmId", "active", "sortOrder");
CREATE UNIQUE INDEX "MatterFieldValue_matterId_fieldDefinitionId_key" ON "MatterFieldValue"("matterId", "fieldDefinitionId");
CREATE INDEX "MatterFieldValue_fieldDefinitionId_idx" ON "MatterFieldValue"("fieldDefinitionId");

ALTER TABLE "MatterFieldDefinition" ADD CONSTRAINT "MatterFieldDefinition_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterFieldValue" ADD CONSTRAINT "MatterFieldValue_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterFieldValue" ADD CONSTRAINT "MatterFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "MatterFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
