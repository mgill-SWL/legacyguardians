import Link from "next/link";

export const dynamic = "force-dynamic";

export default function KpisHome() {
  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">KPIs</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Reporting tables (manual entry) + summary views.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 10, maxWidth: 720 }}>
        <Link className="sw-btn" href="/management/kpis/intake">
          Intake (summary)
        </Link>
        <Link className="sw-btn" href="/management/kpis/l10/reporting">
          L10 (reporting)
        </Link>
        <Link className="sw-btn" href="/management/kpis/l10/summary">
          L10 (summary)
        </Link>
        <Link className="sw-btn" href="/management/kpis/timekeepers/reporting">
          Timekeepers (reporting)
        </Link>
        <Link className="sw-btn" href="/management/kpis/timekeepers/summary">
          Timekeepers (summary)
        </Link>
      </div>
    </div>
  );
}
