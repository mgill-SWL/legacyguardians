import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { EngagementStatusCard } from "./EngagementStatusCard";
import { LeadRecordShell } from "./LeadRecordShell";
import { LeadReviewPanel } from "./LeadReviewPanel";
import styles from "./leadRecord.module.css";

export const dynamic = "force-dynamic";

type TimelineEvent = {
  at: Date;
  detail: string;
  href?: string;
  kind: string;
  title: string;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  }).format(value);
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
      messageThreads: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            select: { body: true, createdAt: true, direction: true },
            take: 1,
          },
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        take: 10,
      },
      prequalSubmissions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!lead) notFound();

  const leadName = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();
  const timeline: TimelineEvent[] = [
    {
      at: lead.dateAdded,
      detail: `Created from ${lead.campaign.name}`,
      kind: "Lead",
      title: "Lead created",
    },
    lead.intakeCallAttemptedAt
      ? {
          at: lead.intakeCallAttemptedAt,
          detail: "Intake call attempt recorded",
          kind: "Intake",
          title: "Intake attempted",
        }
      : null,
    lead.appt1At
      ? {
          at: lead.appt1At,
          detail: lead.appt1Status ? statusLabel(lead.appt1Status) : "Discovery call scheduled",
          kind: "Appointment",
          title: "Discovery call",
        }
      : null,
    lead.appt2At
      ? {
          at: lead.appt2At,
          detail: lead.appt2Status ? statusLabel(lead.appt2Status) : "Document tour scheduled",
          kind: "Appointment",
          title: "Document tour",
        }
      : null,
    lead.proposalPreparedAt
      ? {
          at: lead.proposalPreparedAt,
          detail: "Estate planning proposal prepared",
          href: `/crm/leads/${lead.id}/proposal`,
          kind: "Proposal",
          title: "Proposal prepared",
        }
      : null,
    lead.raPreparedAt
      ? {
          at: lead.raPreparedAt,
          detail: "Representation agreement prepared",
          kind: "Engagement",
          title: "Agreement prepared",
        }
      : null,
    lead.raSentAt
      ? {
          at: lead.raSentAt,
          detail: "Representation agreement sent",
          kind: "Engagement",
          title: "Agreement sent",
        }
      : null,
    lead.raSignedAt
      ? {
          at: lead.raSignedAt,
          detail: "Representation agreement signed",
          kind: "Engagement",
          title: "Agreement signed",
        }
      : null,
    lead.convertedAt
      ? {
          at: lead.convertedAt,
          detail: lead.convertedMatter?.displayName || "Lead converted to matter",
          href: lead.convertedMatterId ? `/matters/${lead.convertedMatterId}` : undefined,
          kind: "Matter",
          title: "Matter opened",
        }
      : null,
    ...lead.prequalSubmissions.map((submission) => ({
      at: submission.createdAt,
      detail: submission.qualified ? "Qualified webinar prequal submitted" : "Webinar prequal submitted",
      href: `/crm/prequal/${submission.id}`,
      kind: "Form",
      title: "Webinar prequal",
    })),
    ...lead.messageThreads.map((thread) => {
      const lastMessage = thread.messages[0];
      return {
        at: thread.lastMessageAt || lastMessage?.createdAt || thread.createdAt,
        detail: lastMessage
          ? `${statusLabel(lastMessage.direction)}: ${lastMessage.body.slice(0, 120)}`
          : statusLabel(thread.intakeResolutionStatus),
        href: `/crm/inbox/${thread.id}`,
        kind: "Inbox",
        title: "Message thread",
      };
    }),
  ].filter((event): event is TimelineEvent => Boolean(event)).sort((a, b) => b.at.getTime() - a.at.getTime());

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
              <span className={styles.detailLabel}>Duplicate review</span>
              <strong className={styles.detailValue}>{lead.duplicateReviewNotes || lead.duplicateReviewStatus.replaceAll("_", " ")}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Conflict check</span>
              <strong className={styles.detailValue}>{lead.conflictCheckNotes || lead.conflictCheckStatus.replaceAll("_", " ")}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Conversion</span>
              <strong className={styles.detailValue}>
                {lead.convertedMatterId ? lead.convertedMatter?.displayName || "Converted matter" : "Not converted"}
              </strong>
            </div>
          </div>

          <div className={styles.sourceLinks}>
            <span className={styles.detailLabel}>Origin records</span>
            {lead.prequalSubmissions.length ? (
              lead.prequalSubmissions.map((submission) => (
                <Link className={styles.recordLink} href={`/crm/prequal/${submission.id}`} key={submission.id}>
                  View webinar prequal from {submission.createdAt.toISOString().slice(0, 10)}
                </Link>
              ))
            ) : null}
            {lead.messageThreads.length ? (
              lead.messageThreads.map((thread) => (
                <Link className={styles.recordLink} href={`/crm/inbox/${thread.id}`} key={thread.id}>
                  View inbox thread from {(thread.lastMessageAt || thread.createdAt).toISOString().slice(0, 10)}
                </Link>
              ))
            ) : null}
            {!lead.prequalSubmissions.length && !lead.messageThreads.length ? (
              <p>No originating form or inbox thread is linked yet.</p>
            ) : null}
          </div>

          <Link className={styles.recordLink} href={`/crm/leads/${lead.id}/proposal`}>
            Open Estate Planning Proposal
          </Link>
        </main>

        <aside className={styles.panel}>
          <EngagementStatusCard
            convertedMatterId={lead.convertedMatterId}
            leadId={lead.id}
            proposalPreparedAt={lead.proposalPreparedAt}
            raPreparedAt={lead.raPreparedAt}
            raSentAt={lead.raSentAt}
            raSignedAt={lead.raSignedAt}
          />

          <LeadReviewPanel
            conflictCheckNotes={lead.conflictCheckNotes}
            conflictCheckStatus={lead.conflictCheckStatus}
            duplicateReviewNotes={lead.duplicateReviewNotes}
            duplicateReviewStatus={lead.duplicateReviewStatus}
            leadId={lead.id}
          />

          <h2 style={{ marginTop: 20 }}>Record activity</h2>
          <div className={styles.activityList}>
            {timeline.map((event, index) => (
              <div className={styles.activityRow} key={`${event.title}-${event.at.toISOString()}-${index}`}>
                <div className={styles.activityHeader}>
                  <strong>{event.title}</strong>
                  <em>{event.kind}</em>
                </div>
                <span>{formatDateTime(event.at)}</span>
                <p>{event.detail}</p>
                {event.href ? (
                  <Link className={styles.inlineLink} href={event.href}>
                    Open source
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </LeadRecordShell>
  );
}
