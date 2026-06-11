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
      representationAgreementDrafts: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          title: true,
          fileName: true,
          status: true,
          missingTokens: true,
          createdAt: true,
        },
      },
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
          latestAgreementDraft={
            lead.representationAgreementDrafts[0]
              ? {
                  ...lead.representationAgreementDrafts[0],
                  createdAt: lead.representationAgreementDrafts[0].createdAt.toISOString(),
                  downloadHref: `/api/crm/representation-agreements/${lead.representationAgreementDrafts[0].id}/download`,
                }
              : null
          }
          leadId={lead.id}
          leadHref={`/crm/leads/${lead.id}`}
        />
      </div>
    </LeadRecordShell>
  );
}
