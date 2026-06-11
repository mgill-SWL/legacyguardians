import Link from "next/link";

import styles from "./leadRecord.module.css";

type LeadShellData = {
  id: string;
  name: string;
  phone?: string | null;
  campaign: string;
  dateAdded: Date;
  additionalNotes?: string | null;
  intakeCallAttempted: boolean;
  appt1At?: Date | null;
  appt1Status?: string | null;
  appt2At?: Date | null;
  appt2Status?: string | null;
  leadQualityScore?: number | null;
  closed: boolean;
  cashCollectedCents: number;
  revenueCents: number;
  convertedMatterId?: string | null;
  convertedMatterName?: string | null;
  conflictCheckStatus: string;
  duplicateReviewStatus: string;
  proposalPreparedAt?: Date | null;
  raPreparedAt?: Date | null;
  raSentAt?: Date | null;
  raSignedAt?: Date | null;
};

type LeadRecordShellProps = {
  activeTab: "overview" | "proposal";
  children: React.ReactNode;
  lead: LeadShellData;
};

function formatDate(value?: Date | null) {
  if (!value) return "Not set";
  return value.toISOString().slice(0, 10);
}

function labelStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LeadRecordShell({ activeTab, children, lead }: LeadRecordShellProps) {
  const tabs = [
    { key: "overview", label: "Overview", href: `/crm/leads/${lead.id}` },
    {
      key: "proposal",
      label: "Estate Planning Proposal",
      href: `/crm/leads/${lead.id}/proposal`,
    },
    { key: "intake", label: "Intake", href: `/crm/leads/${lead.id}` },
    { key: "tasks", label: "Tasks", href: `/crm/leads/${lead.id}` },
    { key: "timeline", label: "Timeline", href: `/crm/leads/${lead.id}` },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumbs}>
        <Link href="/crm">CRM</Link>
        <span>/</span>
        <Link href="/crm/leads">Leads</Link>
      </div>

      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Lead record</div>
          <h1>{lead.name}</h1>
          <p>
            {lead.campaign} · Added {formatDate(lead.dateAdded)}
            {lead.phone ? ` · ${lead.phone}` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          {lead.convertedMatterId ? (
            <Link className={styles.primaryButton} href={`/matters/${lead.convertedMatterId}`}>
              Open matter
            </Link>
          ) : (
            <Link className={styles.primaryButton} href={`/crm/leads/${lead.id}/proposal`}>
              Build proposal
            </Link>
          )}
          <Link className={styles.secondaryButton} href="/crm/leads">
            All leads
          </Link>
        </div>
      </header>

      <section className={styles.statusStrip} aria-label="Lead status">
        <div>
          <span>Discovery call</span>
          <strong>{lead.appt1Status || (lead.appt1At ? "Scheduled" : "Not scheduled")}</strong>
          <small>{formatDate(lead.appt1At)}</small>
        </div>
        <div>
          <span>Document tour</span>
          <strong>{lead.appt2Status || (lead.appt2At ? "Scheduled" : "Not scheduled")}</strong>
          <small>{formatDate(lead.appt2At)}</small>
        </div>
        <div>
          <span>Quality score</span>
          <strong>{lead.leadQualityScore ?? "Not scored"}</strong>
          <small>{lead.intakeCallAttempted ? "Intake attempted" : "Intake not attempted"}</small>
        </div>
        <div>
          <span>Conflict check</span>
          <strong>{labelStatus(lead.conflictCheckStatus)}</strong>
          <small>Intake review flag</small>
        </div>
        <div>
          <span>Duplicate review</span>
          <strong>{labelStatus(lead.duplicateReviewStatus)}</strong>
          <small>Matching policy</small>
        </div>
        <div>
          <span>Engagement</span>
          <strong>{lead.convertedMatterId ? "Converted" : lead.raSignedAt ? "Signed" : lead.raSentAt ? "Sent" : lead.raPreparedAt ? "Prepared" : lead.proposalPreparedAt ? "Proposal ready" : "Open"}</strong>
          <small>{lead.convertedMatterId ? "Matter active" : "Representation agreement"}</small>
        </div>
      </section>

      <nav className={styles.tabs} aria-label="Lead sections">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const isPlaceholder = tab.key !== "overview" && tab.key !== "proposal";
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`${styles.tab} ${isActive ? styles.activeTab : ""} ${
                isPlaceholder ? styles.placeholderTab : ""
              }`}
              href={tab.href}
              key={tab.key}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
