CREATE TYPE "ContactProfessionalType" AS ENUM (
  'FINANCIAL_ADVISOR',
  'CPA',
  'INSURANCE',
  'BANKER',
  'REALTOR',
  'CARE_MANAGER',
  'ATTORNEY',
  'OTHER'
);

CREATE TYPE "ReferralSourceStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'INACTIVE');

ALTER TABLE "Contact" ADD COLUMN "professionalType" "ContactProfessionalType";
ALTER TABLE "Contact" ADD COLUMN "referralSourceStatus" "ReferralSourceStatus";
ALTER TABLE "Contact" ADD COLUMN "relationshipOwnerId" TEXT;

ALTER TABLE "Matter" ADD COLUMN "referralSourceContactId" TEXT;

CREATE INDEX "Contact_firmId_professionalType_idx" ON "Contact"("firmId", "professionalType");
CREATE INDEX "Contact_firmId_referralSourceStatus_idx" ON "Contact"("firmId", "referralSourceStatus");
CREATE INDEX "Contact_relationshipOwnerId_idx" ON "Contact"("relationshipOwnerId");
CREATE INDEX "Matter_referralSourceContactId_idx" ON "Matter"("referralSourceContactId");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_relationshipOwnerId_fkey" FOREIGN KEY ("relationshipOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Matter" ADD CONSTRAINT "Matter_referralSourceContactId_fkey" FOREIGN KEY ("referralSourceContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
