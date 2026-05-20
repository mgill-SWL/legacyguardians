CREATE TYPE "MatterTimelineEventType" AS ENUM (
  'MANUAL_PHONE_CALL',
  'MANUAL_TEXT',
  'MANUAL_EMAIL',
  'MANUAL_MEETING',
  'MANUAL_INTERNAL_NOTE',
  'MANUAL_OTHER',
  'TASK_CREATED',
  'TASK_COMPLETED',
  'TIME_ENTRY_CREATED',
  'PIPELINE_STAGE_CHANGED'
);

CREATE TABLE "MatterTimelineEvent" (
  "id" TEXT NOT NULL,
  "firmId" TEXT NOT NULL,
  "matterId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" "MatterTimelineEventType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "details" JSONB,
  "relatedTaskId" TEXT,
  "relatedTimeEntryId" TEXT,
  "relatedMatterPipelineId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MatterTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatterTimelineEvent_firmId_occurredAt_idx" ON "MatterTimelineEvent"("firmId", "occurredAt");
CREATE INDEX "MatterTimelineEvent_matterId_occurredAt_idx" ON "MatterTimelineEvent"("matterId", "occurredAt");
CREATE INDEX "MatterTimelineEvent_actorUserId_occurredAt_idx" ON "MatterTimelineEvent"("actorUserId", "occurredAt");
CREATE INDEX "MatterTimelineEvent_relatedTaskId_idx" ON "MatterTimelineEvent"("relatedTaskId");
CREATE INDEX "MatterTimelineEvent_relatedTimeEntryId_idx" ON "MatterTimelineEvent"("relatedTimeEntryId");
CREATE INDEX "MatterTimelineEvent_relatedMatterPipelineId_idx" ON "MatterTimelineEvent"("relatedMatterPipelineId");

ALTER TABLE "MatterTimelineEvent" ADD CONSTRAINT "MatterTimelineEvent_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterTimelineEvent" ADD CONSTRAINT "MatterTimelineEvent_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatterTimelineEvent" ADD CONSTRAINT "MatterTimelineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
