import Link from "next/link";

import { prisma } from "@/lib/prisma";

import styles from "./page.module.css";

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

function daysAgo(value: Date | null | undefined) {
  if (!value) return "No touch";
  const days = Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function contactName(contact: { firstName: string; lastName: string; phoneE164: string }) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || contact.phoneE164;
}

export default async function CrmHomePage() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  const [tasks, leads, threads, dueCount, hotCount, openLeadCount, unreadLikeCount, weeklyPrequals] = await Promise.all([
    prisma.crmTask.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lte: now } },
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
      take: 8,
      include: { contact: true, campaign: true, showing: true },
    }),
    prisma.crmLeadPipeline.findMany({
      where: { convertedMatterId: null },
      orderBy: [{ dateAdded: "desc" }],
      take: 7,
      include: { contact: true, campaign: true },
    }),
    prisma.crmMessageThread.findMany({
      where: { provider: "RINGCENTRAL" },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        contact: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.crmTask.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lte: now } } }),
    prisma.crmTask.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, priority: "HOT" } }),
    prisma.crmLeadPipeline.count({ where: { convertedMatterId: null } }),
    prisma.crmMessage.count({ where: { direction: "INBOUND", createdAt: { gte: sevenDaysAgo } } }),
    prisma.crmPrequalSubmission.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
  ]);

  const leadQuality = leads.filter((lead) => (lead.leadQualityScore ?? 0) >= 7).length;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>CRM / Command center</div>
          <h1 className={styles.title}>Lead and relationship workspace</h1>
          <p className={styles.subcopy}>
            Daily work queue, recent replies, active leads, and source health in one operator view.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.button} href="/crm/inbox">
            Open inbox
          </Link>
          <Link className={styles.button} href="/crm/leads">
            All leads
          </Link>
          <Link className={styles.primaryButton} href="/crm/queue">
            Work queue
          </Link>
        </div>
      </div>

      <section className={styles.statusStrip} aria-label="CRM summary">
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Due now</div>
          <div className={styles.metricValue}>{dueCount}</div>
          <div className={styles.metricNote}>Open or in-progress touches.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Hot tasks</div>
          <div className={`${styles.metricValue} ${hotCount ? styles.warning : ""}`}>{hotCount}</div>
          <div className={styles.metricNote}>Priority queue items.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Active leads</div>
          <div className={styles.metricValue}>{openLeadCount}</div>
          <div className={styles.metricNote}>{leadQuality} recent high-quality leads shown.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Inbound replies</div>
          <div className={styles.metricValue}>{unreadLikeCount}</div>
          <div className={styles.metricNote}>Last 7 days.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Prequals</div>
          <div className={styles.metricValue}>{weeklyPrequals}</div>
          <div className={styles.metricNote}>Last 7 days.</div>
        </div>
      </section>

      <div className={styles.layoutGrid}>
        <section className={styles.mainPanel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Next best work</div>
              <div className={styles.panelMeta}>Sorted by due date; use the focused queue for full task handling.</div>
            </div>
            <Link className={styles.textLink} href="/crm/queue">
              View all
            </Link>
          </div>

          <div className={styles.queueList}>
            {tasks.map((task) => (
              <Link className={styles.queueRow} href="/crm/queue" key={task.id}>
                <div>
                  <div className={styles.rowTitle}>{contactName(task.contact)}</div>
                  <div className={styles.rowMeta}>
                    {task.campaign.slug} · {task.type.replaceAll("_", " ")}
                  </div>
                </div>
                <div className={styles.rowContext}>
                  <span className={`${styles.badge} ${task.priority === "HOT" ? styles.badgeWarn : styles.badgeNeutral}`}>
                    {task.priority}
                  </span>
                  <span>{formatDate(task.dueAt)}</span>
                  <span>{task.ownerTeam}</span>
                </div>
              </Link>
            ))}
            {tasks.length === 0 ? (
              <div className={styles.emptyState}>No CRM tasks are due right now.</div>
            ) : null}
          </div>
        </section>

        <aside className={styles.sideStack}>
          <section className={styles.sidePanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>Recent replies</div>
                <div className={styles.panelMeta}>RingCentral threads.</div>
              </div>
            </div>
            <div className={styles.compactList}>
              {threads.map((thread) => {
                const last = thread.messages[0];
                return (
                  <Link className={styles.compactRow} href={`/crm/inbox/${thread.id}`} key={thread.id}>
                    <div className={styles.rowTitle}>{contactName(thread.contact)}</div>
                    <div className={styles.rowMeta}>
                      {last ? `${last.direction}: ${last.body.slice(0, 86)}` : "No messages yet"}
                    </div>
                    <div className={styles.rowTime}>{daysAgo(thread.lastMessageAt || thread.updatedAt)}</div>
                  </Link>
                );
              })}
              {threads.length === 0 ? <div className={styles.emptyState}>No message threads yet.</div> : null}
            </div>
          </section>

          <section className={styles.sidePanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>CRM modules</div>
                <div className={styles.panelMeta}>Current operating surfaces.</div>
              </div>
            </div>
            <div className={styles.moduleGrid}>
              <Link href="/crm/inbox">Inbox</Link>
              <Link href="/crm/queue">Queue</Link>
              <Link href="/crm/leads">Leads</Link>
              <Link href="/crm/intake-reporting">Intake reporting</Link>
              <Link href="/crm/spend">Spend</Link>
              <Link href="/crm/reports/weekly">Weekly report</Link>
            </div>
          </section>
        </aside>
      </div>

      <section className={styles.leadPanel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Active lead pipeline</div>
            <div className={styles.panelMeta}>Recent unconverted leads with appointment and quality signals.</div>
          </div>
          <Link className={styles.textLink} href="/crm/leads">
            Open lead table
          </Link>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Campaign</th>
                <th className={styles.numeric}>Quality</th>
                <th>Intake</th>
                <th>Appt 1</th>
                <th>Appt 2</th>
                <th className={styles.numeric}>Collected</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className={styles.rowTitle}>{contactName(lead.contact)}</div>
                    <div className={styles.rowMeta}>{lead.contact.phoneE164}</div>
                  </td>
                  <td>{lead.campaign.slug}</td>
                  <td className={styles.numeric}>{lead.leadQualityScore ?? ""}</td>
                  <td>{lead.intakeCallAttempted ? "Attempted" : "Not yet"}</td>
                  <td>{lead.appt1At ? `${formatDate(lead.appt1At)} · ${lead.appt1Status ?? "Scheduled"}` : "Not set"}</td>
                  <td>{lead.appt2At ? `${formatDate(lead.appt2At)} · ${lead.appt2Status ?? "Scheduled"}` : "Not set"}</td>
                  <td className={styles.numeric}>${(lead.cashCollectedCents / 100).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 ? <div className={styles.emptyState}>No active leads yet.</div> : null}
      </section>
    </div>
  );
}
