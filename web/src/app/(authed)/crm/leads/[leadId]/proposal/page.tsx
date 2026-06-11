import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { EstatePlanningProposal } from "./EstatePlanningProposal";
import { LeadRecordShell } from "../LeadRecordShell";
import styles from "../leadRecord.module.css";

export const dynamic = "force-dynamic";

export default async function LeadProposalPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const lead = await prisma.crmLeadPipeline.findUnique({
    where: { id: leadId },
    include: {
      campaign: true,
      contact: true,
      convertedMatter: { select: { displayName: true, id: true } },
    },
  });

  if (!lead) notFound();

  const leadName = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();

  return (
    <LeadRecordShell
      activeTab="proposal"
      lead={{
        additionalNotes: lead.additionalNotes,
        appt1At: lead.appt1At,
        appt1Status: lead.appt1Status,
        appt2At: lead.appt2At,
        appt2Status: lead.appt2Status,
        campaign: lead.campaign.slug,
        cashCollectedCents: lead.cashCollectedCents,
        closed: lead.closed,
        convertedMatterId: lead.convertedMatterId,
        convertedMatterName: lead.convertedMatter?.displayName,
        conflictCheckStatus: lead.conflictCheckStatus,
        dateAdded: lead.dateAdded,
        duplicateReviewStatus: lead.duplicateReviewStatus,
        id: lead.id,
        intakeCallAttempted: lead.intakeCallAttempted,
        leadQualityScore: lead.leadQualityScore,
        name: leadName || "Unnamed lead",
        phone: lead.contact.phoneE164,
        revenueCents: lead.revenueCents,
        proposalPreparedAt: lead.proposalPreparedAt,
        raPreparedAt: lead.raPreparedAt,
        raSentAt: lead.raSentAt,
        raSignedAt: lead.raSignedAt,
      }}
    >
      <div className={styles.proposalPane}>
        <EstatePlanningProposal
          embedded
          initialClientName={leadName}
          initialSource={lead.campaign.slug}
          leadId={lead.id}
          leadHref={`/crm/leads/${lead.id}`}
        />
      </div>
    </LeadRecordShell>
  );
}
