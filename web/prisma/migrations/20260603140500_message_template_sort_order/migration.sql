ALTER TABLE "MessageTemplate" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "firmId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" ASC
    ) - 1 AS "nextSortOrder"
  FROM "MessageTemplate"
)
UPDATE "MessageTemplate"
SET "sortOrder" = ranked."nextSortOrder"
FROM ranked
WHERE "MessageTemplate"."id" = ranked."id";

CREATE INDEX "MessageTemplate_firmId_sortOrder_idx" ON "MessageTemplate"("firmId", "sortOrder");
