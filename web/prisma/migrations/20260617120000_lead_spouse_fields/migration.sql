-- Spouse / co-client fields on the lead, for the representation agreement and
-- the second Documenso signer. Flat fields; the spouse is not a Contact record.
ALTER TABLE "CrmLeadPipeline" ADD COLUMN "spouseFirstName" TEXT;
ALTER TABLE "CrmLeadPipeline" ADD COLUMN "spouseLastName" TEXT;
ALTER TABLE "CrmLeadPipeline" ADD COLUMN "spouseEmail" TEXT;
ALTER TABLE "CrmLeadPipeline" ADD COLUMN "spousePhone" TEXT;
