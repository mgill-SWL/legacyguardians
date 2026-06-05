import Link from "next/link";

import { prisma } from "@/lib/prisma";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const modules = [
  {
    href: "/crm/queue",
    label: "Queue",
    description: "Open and in-progress CRM tasks due now.",
  },
  {
    href: "/crm/inbox",
    label: "Inbox",
    description: "RingCentral message threads.",
  },
  {
    href: "/crm/leads",
    label: "All leads",
    description: "Lead pipeline records and conversion actions.",
  },
  {
    href: "/crm/intake-reporting",
    label: "Intake reporting",
    description: "Intake reporting table and sheet sync.",
  },
  {
    href: "/crm/fee-quote",
    label: "Fee quote builder",
    description: "Estate planning proposal workflow and quote calculator.",
  },
  {
    href: "/crm/spend",
    label: "Spend",
    description: "Daily campaign spend entry.",
  },
  {
    href: "/crm/reports/weekly",
    label: "Weekly report",
    description: "Spend and prequalification reporting.",
  },
];

export default async function CrmHomePage() {
  const now = new Date();

  const [dueTasks, threads, leads] = await Promise.all([
    prisma.crmTask.count({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lte: now } },
    }),
    prisma.crmMessageThread.count({ where: { provider: "RINGCENTRAL" } }),
    prisma.crmLeadPipeline.count(),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>CRM</div>
          <h1 className={styles.title}>CRM home</h1>
          <p className={styles.subcopy}>
            Current CRM surfaces, using the existing Legacy Guardians data
            model.
          </p>
        </div>
      </div>

      <section className={styles.statusStrip} aria-label="CRM counts">
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Due tasks</div>
          <div className={styles.metricValue}>{dueTasks}</div>
          <div className={styles.metricNote}>
            Open or in-progress tasks due now.
          </div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Message threads</div>
          <div className={styles.metricValue}>{threads}</div>
          <div className={styles.metricNote}>RingCentral provider threads.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Lead records</div>
          <div className={styles.metricValue}>{leads}</div>
          <div className={styles.metricNote}>
            Rows in the CRM lead pipeline.
          </div>
        </div>
      </section>

      <section className={styles.leadPanel}>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>CRM pages</div>
            <div className={styles.panelMeta}>
              Navigation only; reporting stays on the underlying pages.
            </div>
          </div>
        </div>

        <div className={styles.moduleList}>
          {modules.map((module) => (
            <Link
              className={styles.moduleRow}
              href={module.href}
              key={module.href}
            >
              <span>
                <strong>{module.label}</strong>
                <small>{module.description}</small>
              </span>
              <span aria-hidden>Open</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
