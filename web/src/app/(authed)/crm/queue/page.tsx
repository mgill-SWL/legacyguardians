import Link from "next/link";

import { prisma } from "@/lib/prisma";

import styles from "../page.module.css";
import { QueueList, type QueueTask } from "./QueueList";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function contactName(contact: { firstName: string; lastName: string; phoneE164: string }) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || contact.phoneE164;
}

export default async function CrmQueuePage() {
  const now = new Date();
  const tasks = await prisma.crmTask.findMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      dueAt: { lte: now },
    },
    orderBy: [{ dueAt: "asc" }],
    take: 50,
    include: {
      contact: true,
      campaign: true,
      showing: true,
    },
  });

  const hotCount = tasks.filter((task) => task.priority === "HOT").length;
  const inProgressCount = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const overdueCount = tasks.filter((task) => task.dueAt.getTime() < now.getTime()).length;

  const serialized: QueueTask[] = tasks.map((task) => ({
    id: task.id,
    contactName: contactName(task.contact),
    phone: task.contact.phoneE164,
    type: task.type,
    campaignSlug: task.campaign.slug,
    ownerTeam: task.ownerTeam,
    showingLabel: task.showing ? formatDate(task.showing.startsAt) : null,
    priority: task.priority,
    status: task.status,
    disposition: task.disposition,
    dueAtISO: task.dueAt.toISOString(),
    lastTouchLabel: task.lastTouchAt ? formatDate(task.lastTouchAt) : null,
    notes: task.notes,
  }));

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>CRM / Queue</div>
          <h1 className={styles.title}>CRM Queue</h1>
          <p className={styles.subcopy}>
            Open and in-progress CRM tasks due now. Update status, priority, disposition, due date, and notes inline.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.button} href="/crm">
            CRM home
          </Link>
          <Link className={styles.button} href="/crm/inbox">
            Inbox
          </Link>
          <Link className={styles.primaryButton} href="/crm/leads">
            Lead table
          </Link>
        </div>
      </div>

      <section className={styles.statusStrip} aria-label="Queue summary">
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Due tasks</div>
          <div className={styles.metricValue}>{tasks.length}</div>
          <div className={styles.metricNote}>Rows matching the queue filter.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Hot</div>
          <div className={`${styles.metricValue} ${hotCount ? styles.warning : ""}`}>{hotCount}</div>
          <div className={styles.metricNote}>Tasks with HOT priority.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>In progress</div>
          <div className={styles.metricValue}>{inProgressCount}</div>
          <div className={styles.metricNote}>Tasks with IN_PROGRESS status.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Overdue</div>
          <div className={`${styles.metricValue} ${overdueCount ? styles.warning : ""}`}>{overdueCount}</div>
          <div className={styles.metricNote}>Due timestamp before now.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Owner teams</div>
          <div className={styles.metricValue}>{new Set(tasks.map((task) => task.ownerTeam)).size}</div>
          <div className={styles.metricNote}>Distinct ownerTeam values.</div>
        </div>
      </section>

      <section className={styles.leadPanel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Task queue</div>
            <div className={styles.panelMeta}>Work each task inline; “Mark done” clears it from the queue.</div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <QueueList tasks={serialized} />
        </div>
      </section>
    </div>
  );
}
