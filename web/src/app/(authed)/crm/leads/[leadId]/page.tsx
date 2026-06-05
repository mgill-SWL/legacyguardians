import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { LeadRecordShell } from "./LeadRecordShell";
import styles from "./leadRecord.module.css";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
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
      activeTab="overview"
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
        dateAdded: lead.dateAdded,
        id: lead.id,
        intakeCallAttempted: lead.intakeCallAttempted,
        leadQualityScore: lead.leadQualityScore,
        name: leadName || "Unnamed lead",
        phone: lead.contact.phoneE164,
        revenueCents: lead.revenueCents,
      }}
    >
      <div className={styles.contentGrid}>
        <main className={styles.panel}>
          <h2>Lead summary</h2>
          <p>
            This shell gives proposal work a home inside the lead record. The next
            pass can wire editable intake fields, tasks, messages, and timeline
            events into these sections.
          </p>

          <div className={styles.detailGrid}>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Campaign</span>
              <strong className={styles.detailValue}>{lead.campaign.name}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Phone</span>
              <strong className={styles.detailValue}>{lead.contact.phoneE164 || "Not captured"}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Additional notes</span>
              <strong className={styles.detailValue}>{lead.additionalNotes || "No notes yet"}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Conversion</span>
              <strong className={styles.detailValue}>
                {lead.convertedMatterId ? lead.convertedMatter?.displayName || "Converted matter" : "Not converted"}
              </strong>
            </div>
          </div>

          <Link className={styles.recordLink} href={`/crm/leads/${lead.id}/proposal`}>
            Open Estate Planning Proposal
          </Link>
        </main>

        <aside className={styles.panel}>
          <h2>Record activity</h2>
          <p>Placeholder activity stream for the lead record shell.</p>
          <div className={styles.activityList}>
            <div className={styles.activityRow}>
              <strong>Lead created</strong>
              <span>{lead.dateAdded.toISOString().slice(0, 10)} from {lead.campaign.slug}</span>
            </div>
            {lead.intakeCallAttempted ? (
              <div className={styles.activityRow}>
                <strong>Intake attempted</strong>
                <span>{lead.intakeCallAttemptedAt?.toISOString().slice(0, 10) || "Date not captured"}</span>
              </div>
            ) : null}
            {lead.appt1At ? (
              <div className={styles.activityRow}>
                <strong>Discovery call scheduled</strong>
                <span>{lead.appt1At.toISOString().slice(0, 10)}</span>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </LeadRecordShell>
  );
}

