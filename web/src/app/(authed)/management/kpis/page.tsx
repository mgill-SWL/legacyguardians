import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { L10_REPORT_SLUG, TIMEKEEPER_REPORT_SLUG } from "@/lib/kpis/reportTables";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const INTAKE_REPORT_SLUG = "intake-reporting";

const reportLinks = [
  { href: "/management/kpis/intake", label: "Intake summary", meta: "Current lead and document-tour reporting" },
  { href: "/management/kpis/intake-sheet", label: "Intake sheet", meta: "Google Sheet source view" },
  { href: "/management/kpis/l10/reporting", label: "L10 reporting", meta: "Leadership input table" },
  { href: "/management/kpis/l10/summary", label: "L10 summary", meta: "Executive summary view" },
  { href: "/management/kpis/timekeepers/reporting", label: "Timekeepers reporting", meta: "Attorney production inputs" },
  { href: "/management/kpis/timekeepers/summary", label: "Timekeepers summary", meta: "Attorney production rollup" },
];

const recognitionRules = [
  "Trust to General Transfer rows are collection events.",
  "4100 Fee Income counts toward attorney revenue; 4200 and 4250 stay separate.",
  "Refund reversals post in the period when the refund occurs.",
];

type ReportRow = {
  label: string;
  rowKey: string;
  sortOrder: number;
  updatedAt: Date;
  data: unknown;
};

type ReportTable = {
  name: string;
  rows: ReportRow[];
};

function dataFor(row: ReportRow | null | undefined): Record<string, unknown> {
  return row?.data && typeof row.data === "object" && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : {};
}

function n(value: unknown) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/[$,%]/g, "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "Not set") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function currency(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n(value));
}

function percent(value: unknown) {
  const parsed = n(value);
  if (!parsed) return "0%";
  return `${Math.round((parsed <= 1 ? parsed * 100 : parsed) * 10) / 10}%`;
}

function compactDate(value: Date | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function latestUpdatedAt(table: ReportTable | null | undefined) {
  const times = (table?.rows || []).map((row) => row.updatedAt.getTime()).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)) : null;
}

function latestRow(table: ReportTable | null | undefined) {
  const rows = [...(table?.rows || [])];
  return rows.sort((a, b) => a.sortOrder - b.sortOrder).at(-1) || null;
}

function latestTimekeeperRows(table: ReportTable | null | undefined) {
  const rows = [...(table?.rows || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const latestMonth = [...rows].reverse().map((row) => text(dataFor(row).month, "")).find(Boolean);
  if (!latestMonth) return rows.slice(-8);
  return rows.filter((row) => text(dataFor(row).month, "") === latestMonth);
}

function sumRows(rows: ReportRow[], key: string) {
  return rows.reduce((total, row) => total + n(dataFor(row)[key]), 0);
}

function sourceRows(tables: { label: string; table: ReportTable | null; configured: boolean }[]) {
  return tables.map(({ label, table, configured }) => {
    const rows = table?.rows.length ?? 0;
    const updatedAt = latestUpdatedAt(table);
    return {
      name: label,
      state: rows ? "Live" : configured ? "No rows" : "Manual",
      detail: rows
        ? `${rows.toLocaleString()} rows available. Latest row update: ${compactDate(updatedAt)}.`
        : configured
          ? "Google Sheet sync is configured, but no rows are available yet."
          : "No spreadsheet sync env var is configured; reporting can still be entered manually.",
    };
  });
}

export default async function KpisHome() {
  const [timekeeperTable, l10Table, intakeTable] = await Promise.all([
    prisma.reportTable.findUnique({
      where: { slug: TIMEKEEPER_REPORT_SLUG },
      include: { rows: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.reportTable.findUnique({
      where: { slug: L10_REPORT_SLUG },
      include: { rows: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.reportTable.findUnique({
      where: { slug: INTAKE_REPORT_SLUG },
      include: { rows: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  const timekeeperRows = latestTimekeeperRows(timekeeperTable);
  const l10Rows = [...(l10Table?.rows || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeL10Row = latestRow(l10Table);
  const activeL10 = dataFor(activeL10Row);
  const intakeRows = intakeTable?.rows || [];

  const latestPeriod = text(activeL10.month || dataFor(timekeeperRows[0]).month || activeL10Row?.label, "Current reporting");
  const feesCollected = sumRows(timekeeperRows, "fees_collected");
  const feesBilled = sumRows(timekeeperRows, "fees_billed");
  const docTours = sumRows(intakeRows, "doc_tour_held");
  const scheduledIntake = sumRows(intakeRows, "scheduled_intake");
  const totalCaseRevenue = n(activeL10.ep_case_revenue) + n(activeL10.other_case_revenue);
  const realization = feesBilled ? feesCollected / feesBilled : 0;

  const attorneyRows = timekeeperRows.map((row) => {
    const data = dataFor(row);
    const rowFeesCollected = n(data.fees_collected);
    const rowFeesBilled = n(data.fees_billed);
    const rowRealization = rowFeesBilled ? rowFeesCollected / rowFeesBilled : 0;
    return {
      person: text(data.timekeeper || row.label),
      period: text(data.month || latestPeriod),
      collected: currency(rowFeesCollected),
      billed: currency(rowFeesBilled),
      avgCaseValue: currency(data.avg_case_value),
      realization: percent(rowRealization),
      newMatters: String(n(data.new_matters_opened)),
      welcomeCalls: String(n(data.welcome_calls_held)),
      status: rowRealization && rowRealization < 0.75 ? "Watch" : "Current",
    };
  });

  const trendRows = l10Rows.slice(-6).map((row) => {
    const data = dataFor(row);
    const collected = n(data.monthly_collections);
    const revenue = n(data.ep_case_revenue) + n(data.other_case_revenue);
    return { label: text(data.month || row.label), collected, revenue };
  });
  const trendMax = Math.max(1, ...trendRows.flatMap((row) => [row.collected, row.revenue]));

  const syncRows = sourceRows([
    { label: "Timekeeper KPI sheet", table: timekeeperTable, configured: !!process.env.LG_TIMEKEEPER_KPI_SPREADSHEET_ID },
    { label: "L10 reporting sheet", table: l10Table, configured: !!process.env.LG_L10_KPI_SPREADSHEET_ID },
    { label: "Intake reporting sheet", table: intakeTable, configured: !!process.env.LG_INTAKE_KPI_SPREADSHEET_ID },
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.utilityBar}>
        <div className={styles.searchBox}>Live KPI reporting from Report Tables</div>
        <div className={styles.utilityMeta}>
          <span>Speedwell Law</span>
          <span>{latestPeriod}</span>
        </div>
      </div>

      <div className={styles.topbar}>
        <div>
          <div className={styles.eyebrow}>Management / KPIs</div>
          <h1 className={styles.title}>Firm KPI command center</h1>
          <p className={styles.subcopy}>
            A compact operating view for collections, attorney production, intake conversion, and source freshness.
          </p>
        </div>
        <div className={styles.actions} aria-label="KPI actions">
          <Link className={styles.button} href="/management/kpis/l10/summary">
            Open L10 summary
          </Link>
          <Link className={styles.button} href="/admin/imports/invoice-payment-allocations">
            Import allocations
          </Link>
          <Link className={styles.primaryButton} href="/management/kpis/timekeepers/reporting">
            Sync sheets
          </Link>
        </div>
      </div>

      <section className={styles.statusStrip} aria-label="Firm KPI summary">
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Reporting period</div>
          <div className={styles.metricValue}>{latestPeriod}</div>
          <div className={styles.metricNote}>Latest live KPI row available.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Monthly collections</div>
          <div className={styles.metricValue}>{currency(activeL10.monthly_collections || feesCollected)}</div>
          <div className={styles.metricNote}>Latest L10 row; timekeeper total fallback.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Case revenue</div>
          <div className={styles.metricValue}>{currency(totalCaseRevenue || feesCollected)}</div>
          <div className={styles.metricNote}>EP + other case revenue.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Doc tours held</div>
          <div className={styles.metricValue}>{docTours.toLocaleString()}</div>
          <div className={styles.metricNote}>Intake reporting total.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Intake scheduled</div>
          <div className={styles.metricValue}>{scheduledIntake.toLocaleString()}</div>
          <div className={styles.metricNote}>Intake reporting total.</div>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Attorney production</div>
              <div className={styles.panelMeta}>Latest available timekeeper KPI rows.</div>
            </div>
            <div className={styles.panelMeta}>{latestPeriod}</div>
          </div>

          <div className={styles.filterBar}>
            <span className={styles.filterChip}>Firm: Speedwell Law</span>
            <span className={styles.filterChip}>Period: {latestPeriod}</span>
            <span className={styles.filterChip}>Rows: {timekeeperRows.length}</span>
            <span className={styles.filterChip}>Realization: {percent(realization)}</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Timekeeper</th>
                  <th>Period</th>
                  <th className={styles.numeric}>Collected</th>
                  <th className={styles.numeric}>Billed</th>
                  <th className={styles.numeric}>Avg case</th>
                  <th className={styles.numeric}>Realiz.</th>
                  <th className={styles.numeric}>New matters</th>
                  <th className={styles.numeric}>Welcome</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attorneyRows.map((row) => (
                  <tr key={row.person}>
                    <td className={styles.person}>{row.person}</td>
                    <td>{row.period}</td>
                    <td className={styles.numeric}>{row.collected}</td>
                    <td className={styles.numeric}>{row.billed}</td>
                    <td className={styles.numeric}>{row.avgCaseValue}</td>
                    <td className={styles.numeric}>{row.realization}</td>
                    <td className={styles.numeric}>{row.newMatters}</td>
                    <td className={styles.numeric}>{row.welcomeCalls}</td>
                    <td>
                      <span className={`${styles.badge} ${row.status === "Current" ? styles.badgeGood : styles.badgeWarn}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {attorneyRows.length === 0 ? <div className={styles.emptyState}>No timekeeper KPI rows are available yet.</div> : null}
          </div>

          <div className={styles.mobileCards}>
            {attorneyRows.map((row) => (
              <div className={styles.mobileCard} key={row.person}>
                <div className={styles.mobileCardTop}>
                  <div>
                    <div className={styles.person}>{row.person}</div>
                    <div className={styles.panelMeta}>{row.period}</div>
                  </div>
                  <span className={`${styles.badge} ${row.status === "Current" ? styles.badgeGood : styles.badgeWarn}`}>
                    {row.status}
                  </span>
                </div>
                <div className={styles.mobileMetrics}>
                  <div className={styles.mobileMetricBox}>
                    <div className={styles.metricLabel}>Collected</div>
                    <div className={styles.metricValue}>{row.collected}</div>
                  </div>
                  <div className={styles.mobileMetricBox}>
                    <div className={styles.metricLabel}>Billed</div>
                    <div className={styles.metricValue}>{row.billed}</div>
                  </div>
                  <div className={styles.mobileMetricBox}>
                    <div className={styles.metricLabel}>Avg case</div>
                    <div className={styles.metricValue}>{row.avgCaseValue}</div>
                  </div>
                  <div className={styles.mobileMetricBox}>
                    <div className={styles.metricLabel}>Realization</div>
                    <div className={styles.metricValue}>{row.realization}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className={styles.sideStack}>
          <section className={styles.syncPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>Reporting sync</div>
                <div className={styles.panelMeta}>Visible source state before review.</div>
              </div>
            </div>
            <div className={styles.syncRows}>
              {syncRows.map((row) => (
                <div className={styles.syncRow} key={row.name}>
                  <div className={styles.syncTop}>
                    <div className={styles.syncName}>{row.name}</div>
                    <span className={`${styles.badge} ${row.state === "Live" ? styles.badgeGood : styles.badgeWarn}`}>
                      {row.state}
                    </span>
                  </div>
                  <div className={styles.syncDetail}>{row.detail}</div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.eventPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>Collections trend</div>
                <div className={styles.panelMeta}>Monthly collections vs case revenue.</div>
              </div>
            </div>
            <div className={styles.chartLegend} aria-hidden="true">
              <span><i className={styles.legendCollected} /> Collections</span>
              <span><i className={styles.legendRevenue} /> Case revenue</span>
            </div>
            <div className={styles.miniChart} aria-label="Monthly collections and case revenue trend chart">
              {trendRows.map((row) => (
                <div className={styles.barGroup} key={row.label} title={`${row.label}: ${currency(row.collected)} collected, ${currency(row.revenue)} revenue`}>
                  <div className={styles.barMuted} style={{ height: `${Math.max(4, (row.revenue / trendMax) * 100)}%` }} />
                  <div className={styles.bar} style={{ height: `${Math.max(4, (row.collected / trendMax) * 100)}%` }} />
                </div>
              ))}
            </div>
            <div className={styles.chartLabels}>
              {trendRows.map((row) => (
                <span key={row.label}>{row.label.slice(0, 3)}</span>
              ))}
            </div>
            {trendRows.length === 0 ? <div className={styles.emptyState}>No L10 trend rows are available yet.</div> : null}
          </section>

          <section className={styles.eventPanel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelTitle}>Recognition rules</div>
                <div className={styles.panelMeta}>Shown inline so numbers are reviewable.</div>
              </div>
            </div>
            {recognitionRules.map((rule) => (
              <div className={styles.eventRow} key={rule}>
                <div className={styles.eventName}>{rule}</div>
              </div>
            ))}
          </section>
        </aside>
      </div>

      <section className={styles.reportLibrary} aria-label="KPI reports">
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>Report library</div>
            <div className={styles.panelMeta}>Current tables and summaries remain one click away.</div>
          </div>
        </div>
        <div className={styles.reportGrid}>
          {reportLinks.map((report) => (
            <Link className={styles.reportLink} href={report.href} key={report.href}>
              <span>{report.label}</span>
              <small>{report.meta}</small>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
