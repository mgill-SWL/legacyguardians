ALTER TABLE "Firm" ADD COLUMN "emailFromName" TEXT;
ALTER TABLE "Firm" ADD COLUMN "emailFromAddress" TEXT;
ALTER TABLE "Firm" ADD COLUMN "emailReplyToAddress" TEXT;
ALTER TABLE "Firm" ADD COLUMN "emailSendingDomain" TEXT;
ALTER TABLE "Firm" ADD COLUMN "emailSendingDomainVerifiedAt" TIMESTAMP(3);

UPDATE "Firm"
SET
  "emailFromName" = COALESCE("emailFromName", 'Speedwell Law'),
  "emailFromAddress" = COALESCE("emailFromAddress", 'no-reply@speedwelllaw.com'),
  "emailSendingDomain" = COALESCE("emailSendingDomain", 'speedwelllaw.com')
WHERE "slug" = 'SWL' OR lower("name") LIKE '%speedwell%';
