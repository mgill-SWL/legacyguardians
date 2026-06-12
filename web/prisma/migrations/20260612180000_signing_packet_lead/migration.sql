-- Link signing packets to CRM leads so the Documenso webhook can auto-stamp
-- the lead's RA-signed milestone when an envelope completes.
ALTER TABLE "SigningPacket" ADD COLUMN "leadId" TEXT;

ALTER TABLE "SigningPacket" ADD CONSTRAINT "SigningPacket_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "CrmLeadPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SigningPacket_leadId_idx" ON "SigningPacket"("leadId");
