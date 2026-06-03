import Link from "next/link";

import { prisma } from "@/lib/prisma";

import styles from "../page.module.css";
import queueStyles from "./queue.module.css";

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

function contactName(contact: {
  firstName: string;
  lastName: string;
  phoneE164: string;
}) {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || contact.phoneE164;
}

function taskLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
  const inProgressCount = tasks.filter(
    (task) => task.status === "IN_PROGRESS",
  ).length;
  const overdueCount = tasks.filter(
    (task) => task.dueAt.getTime() < now.getTime(),
  ).length;

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>CRM / Queue</div>
          <h1 className={styles.title}>CRM Queue</h1>
          <p className={styles.subcopy}>
            Open and in-progress CRM tasks due now.
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
          <div className={styles.metricNote}>
            Rows matching the queue filter.
          </div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Hot</div>
          <div
            className={`${styles.metricValue} ${hotCount ? styles.warning : ""}`}
          >
            {hotCount}
          </div>
          <div className={styles.metricNote}>Tasks with HOT priority.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>In progress</div>
          <div className={styles.metricValue}>{inProgressCount}</div>
          <div className={styles.metricNote}>
            Tasks with IN_PROGRESS status.
          </div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Overdue</div>
          <div
            className={`${styles.metricValue} ${overdueCount ? styles.warning : ""}`}
          >
            {overdueCount}
          </div>
          <div className={styles.metricNote}>Due timestamp before now.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Owner teams</div>
          <div className={styles.metricValue}>
            {new Set(tasks.map((task) => task.ownerTeam)).size}
          </div>
          <div className={styles.metricNote}>Distinct ownerTeam values.</div>
        </div>
      </section>

      <section className={styles.leadPanel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Task queue</div>
            <div className={styles.panelMeta}>
              Direct view of CRM task rows due now.
            </div>
          </div>
        </div>

        <div className={`${styles.tableWrap} ${queueStyles.desktopTable}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Task</th>
                <th>Campaign</th>
                <th>Showing</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Last touch</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>
                    <div className={styles.rowTitle}>
                      {contactName(task.contact)}
                    </div>
                    <div className={styles.rowMeta}>
                      {task.contact.phoneE164}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${task.priority === "HOT" ? styles.badgeWarn : styles.badgeNeutral}`}
                    >
                      {task.priority}
                    </span>{" "}
                    {taskLabel(task.type)}
                  </td>
                  <td>{task.campaign.slug}</td>
                  <td>
                    {task.showing ? formatDate(task.showing.startsAt) : "None"}
                  </td>
                  <td>{task.ownerTeam}</td>
                  <td>{taskLabel(task.status)}</td>
                  <td>{formatDate(task.lastTouchAt)}</td>
                  <td>{formatDate(task.dueAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={queueStyles.mobileCards}>
          {tasks.map((task) => (
            <div className={queueStyles.mobileCard} key={task.id}>
              <div className={queueStyles.mobileTop}>
                <div>
                  <div className={styles.rowTitle}>
                    {contactName(task.contact)}
                  </div>
                  <div className={styles.rowMeta}>{task.contact.phoneE164}</div>
                </div>
                <span
                  className={`${styles.badge} ${task.priority === "HOT" ? styles.badgeWarn : styles.badgeNeutral}`}
                >
                  {task.priority}
                </span>
              </div>
              <div className={queueStyles.mobileFacts}>
                <div>
                  <span>Task</span>
                  <strong>{taskLabel(task.type)}</strong>
                </div>
                <div>
                  <span>Owner</span>
                  <strong>{task.ownerTeam}</strong>
                </div>
                <div>
                  <span>Campaign</span>
                  <strong>{task.campaign.slug}</strong>
                </div>
                <div>
                  <span>Due</span>
                  <strong>{formatDate(task.dueAt)}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>

        {tasks.length === 0 ? (
          <div className={styles.emptyState}>Nothing is due right now.</div>
        ) : null}
      </section>
    </div>
  );
}
