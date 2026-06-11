import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import styles from "../../leads/[leadId]/leadRecord.module.css";

export const dynamic = "force-dynamic";

function label(value?: string | null) {
  if (!value) return "Not captured";
  return value.replaceAll("-", " ").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function answerText(value: unknown) {
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "None selected";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "Not captured";
  return String(value);
}

export default async function CrmPrequalSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const submission = await prisma.crmPrequalSubmission.findUnique({
    where: { id: submissionId },
    include: {
      campaign: true,
      contact: true,
      lead: { include: { contact: true } },
      registration: true,
    },
  });

  if (!submission) notFound();

  const answers = submission.answers && typeof submission.answers === "object" && !Array.isArray(submission.answers)
    ? submission.answers as Record<string, unknown>
    : {};

  const leadName = submission.lead
    ? `${submission.lead.contact.firstName} ${submission.lead.contact.lastName}`.trim() || submission.lead.contact.phoneE164
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href="/crm">CRM</Link>
        <span>/</span>
        <Link href="/crm/leads">Leads</Link>
        {submission.leadId ? (
          <>
            <span>/</span>
            <Link href={`/crm/leads/${submission.leadId}`}>{leadName || "Lead"}</Link>
          </>
        ) : null}
      </div>

      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Webinar prequal submission</div>
          <h1>
            {submission.contact.firstName} {submission.contact.lastName}
          </h1>
          <p>
            {submission.campaign.name} · {submission.createdAt.toISOString().slice(0, 10)}
            {submission.contact.phoneE164 ? ` · ${submission.contact.phoneE164}` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          {submission.leadId ? (
            <Link className={styles.primaryButton} href={`/crm/leads/${submission.leadId}`}>
              Open lead
            </Link>
          ) : null}
          <Link className={styles.secondaryButton} href="/crm/leads">
            All leads
          </Link>
        </div>
      </header>

      <section className={styles.contentGrid}>
        <main className={styles.panel}>
          <h2>Qualification answers</h2>
          <div className={styles.detailGrid}>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Qualified</span>
              <strong className={styles.detailValue}>{submission.qualified ? "Yes" : "No"}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Planning stage</span>
              <strong className={styles.detailValue}>{label(submission.estatePlanningStage)}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Primary concern</span>
              <strong className={styles.detailValue}>{label(submission.primaryConcern)}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Estate band</span>
              <strong className={styles.detailValue}>{label(submission.estateWorthBand)}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Ready to start</span>
              <strong className={styles.detailValue}>{label(submission.readyToStart)}</strong>
            </div>
            <div className={styles.detailCell}>
              <span className={styles.detailLabel}>Existing documents</span>
              <strong className={styles.detailValue}>{answerText(submission.docsInPlace)}</strong>
            </div>
          </div>

          <div className={styles.noteBlock}>
            <span className={styles.detailLabel}>Notes</span>
            <p>{submission.additionalNotes || "No notes submitted."}</p>
          </div>
        </main>

        <aside className={styles.panel}>
          <h2>Submission source</h2>
          <div className={styles.activityList}>
            <div className={styles.activityRow}>
              <strong>Source</strong>
              <span>{submission.source}</span>
            </div>
            <div className={styles.activityRow}>
              <strong>Campaign</strong>
              <span>{submission.campaign.name}</span>
            </div>
            <div className={styles.activityRow}>
              <strong>Registration</strong>
              <span>{submission.registration?.watchToken ? "Linked webinar registration" : "No registration linked"}</span>
            </div>
          </div>

          <h2 style={{ marginTop: 20 }}>Raw answers</h2>
          <div className={styles.activityList}>
            {Object.entries(answers).map(([key, value]) => (
              <div className={styles.activityRow} key={key}>
                <strong>{label(key)}</strong>
                <span>{answerText(value)}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}
