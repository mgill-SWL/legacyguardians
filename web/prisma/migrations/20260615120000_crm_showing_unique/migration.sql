-- De-duplicate existing showings sharing (campaignId, startsAt) before adding
-- the unique index, repointing their registrations and tasks to the survivor
-- (earliest createdAt) so no data is lost and the index creates safely.
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY "campaignId", "startsAt" ORDER BY "createdAt", id
    ) AS keep_id
  FROM "CrmShowing"
)
UPDATE "CrmRegistration" r
SET "showingId" = ranked.keep_id
FROM ranked
WHERE r."showingId" = ranked.id
  AND ranked.id <> ranked.keep_id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY "campaignId", "startsAt" ORDER BY "createdAt", id
    ) AS keep_id
  FROM "CrmShowing"
)
UPDATE "CrmTask" t
SET "showingId" = ranked.keep_id
FROM ranked
WHERE t."showingId" = ranked.id
  AND ranked.id <> ranked.keep_id;

DELETE FROM "CrmShowing" s
USING (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY "campaignId", "startsAt" ORDER BY "createdAt", id
    ) AS keep_id
  FROM "CrmShowing"
) ranked
WHERE s.id = ranked.id
  AND ranked.id <> ranked.keep_id;

CREATE UNIQUE INDEX "CrmShowing_campaignId_startsAt_key"
  ON "CrmShowing"("campaignId", "startsAt");
