import Link from "next/link";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const rows = [
  {
    person: "Michael Gill",
    location: "Alexandria",
    monthly: "$84,250",
    fees: "$61,780",
    billed: "$72,400",
    realization: "85%",
    intake: "17",
    documentTours: "9",
    status: "On pace",
  },
  {
    person: "Alexandra Filiault",
    location: "Alexandria",
    monthly: "$42,960",
    fees: "$38,410",
    billed: "$45,200",
    realization: "91%",
    intake: "11",
    documentTours: "6",
    status: "On pace",
  },
  {
    person: "Arjan Grover",
    location: "Merrifield",
    monthly: "$29,880",
    fees: "$24,620",
    billed: "$33,900",
    realization: "73%",
    intake: "8",
    documentTours: "3",
    status: "Watch",
  },
  {
    person: "Omer Ozusta",
    location: "Alexandria",
    monthly: "$12,740",
    fees: "$10,930",
    billed: "$18,600",
    realization: "59%",
    intake: "5",
    documentTours: "2",
    status: "Watch",
  },
];

const syncRows = [
  {
    name: "Timekeeper KPI sheet",
    state: "Synced",
    detail: "599 rows refreshed from Google Sheets at 8:42 AM.",
  },
  {
    name: "L10 reporting sheet",
    state: "Synced",
    detail: "Weekly leadership metrics are current through May 31.",
  },
  {
    name: "Invoice Payment Allocations",
    state: "Needs import",
    detail: "Operating-side collected revenue needs the June export before final close.",
  },
];

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

export default function KpisHome() {
  return (
    <div className={styles.page}>
      <div className={styles.utilityBar}>
        <div className={styles.searchBox}>Search matters, clients, reports...</div>
        <div className={styles.utilityMeta}>
          <span>Speedwell Law</span>
          <span>June 2026</span>
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
          <div className={styles.metricLabel}>Close status</div>
          <div className={styles.metricValue}>May review</div>
          <div className={styles.metricNote}>2 inputs need attention before final posting.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Collected MTD</div>
          <div className={styles.metricValue}>$169,570</div>
          <div className={`${styles.metricNote} ${styles.positive}`}>+12.4% vs goal pace</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>4100 fee income</div>
          <div className={styles.metricValue}>$135,740</div>
          <div className={styles.metricNote}>Revenue KPI basis</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Doc tours held</div>
          <div className={styles.metricValue}>20</div>
          <div className={styles.metricNote}>Last 4 weeks</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Unreconciled</div>
          <div className={`${styles.metricValue} ${styles.warning}`}>7</div>
          <div className={styles.metricNote}>Transactions in review queue</div>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <div className={styles.panelTitle}>Attorney production</div>
              <div className={styles.panelMeta}>Applied date recognition; 4100 only for collected revenue KPIs.</div>
            </div>
            <div className={styles.panelMeta}>May 2026</div>
          </div>

          <div className={styles.filterBar}>
            <span className={styles.filterChip}>Firm: Speedwell Law</span>
            <span className={styles.filterChip}>Period: May 2026</span>
            <span className={styles.filterChip}>Location: All</span>
            <span className={styles.filterChip}>Source: Sheet + DB imports</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Timekeeper</th>
                  <th>Location</th>
                  <th className={styles.numeric}>Monthly</th>
                  <th className={styles.numeric}>4100 fees</th>
                  <th className={styles.numeric}>Billed</th>
                  <th className={styles.numeric}>Realiz.</th>
                  <th className={styles.numeric}>Intake</th>
                  <th className={styles.numeric}>Doc tours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.person}>
                    <td className={styles.person}>{row.person}</td>
                    <td>{row.location}</td>
                    <td className={styles.numeric}>{row.monthly}</td>
                    <td className={styles.numeric}>{row.fees}</td>
                    <td className={styles.numeric}>{row.billed}</td>
                    <td className={styles.numeric}>{row.realization}</td>
                    <td className={styles.numeric}>{row.intake}</td>
                    <td className={styles.numeric}>{row.documentTours}</td>
                    <td>
                      <span className={`${styles.badge} ${row.status === "On pace" ? styles.badgeGood : styles.badgeWarn}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCards}>
            {rows.map((row) => (
              <div className={styles.mobileCard} key={row.person}>
                <div className={styles.mobileCardTop}>
                  <div>
                    <div className={styles.person}>{row.person}</div>
                    <div className={styles.panelMeta}>{row.location}</div>
                  </div>
                  <span className={`${styles.badge} ${row.status === "On pace" ? styles.badgeGood : styles.badgeWarn}`}>
                    {row.status}
                  </span>
                </div>
                <div className={styles.mobileMetrics}>
                  <div className={styles.mobileMetricBox}>
                    <div className={styles.metricLabel}>Collected</div>
                    <div className={styles.metricValue}>{row.monthly}</div>
                  </div>
                  <div className={styles.mobileMetricBox}>
                    <div className={styles.metricLabel}>4100 fees</div>
                    <div className={styles.metricValue}>{row.fees}</div>
                  </div>
                  <div className={styles.mobileMetricBox}>
                    <div className={styles.metricLabel}>Doc tours</div>
                    <div className={styles.metricValue}>{row.documentTours}</div>
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
                    <span className={`${styles.badge} ${row.state === "Synced" ? styles.badgeGood : styles.badgeWarn}`}>
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
                <div className={styles.panelTitle}>Collected trend</div>
                <div className={styles.panelMeta}>Billed vs collected, six-month view.</div>
              </div>
            </div>
            <div className={styles.miniChart} aria-label="Collected and billed trend chart">
              {[72, 84, 66, 91, 78, 96].map((collected, index) => (
                <div className={styles.barGroup} key={collected}>
                  <div className={styles.barMuted} style={{ height: `${[82, 88, 79, 94, 86, 98][index]}%` }} />
                  <div className={styles.bar} style={{ height: `${collected}%` }} />
                </div>
              ))}
            </div>
            <div className={styles.chartLabels}>
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
            </div>
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
