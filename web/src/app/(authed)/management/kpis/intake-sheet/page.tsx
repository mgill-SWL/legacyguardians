import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { getDefaultGoogleEmailForUser, getIntakeKpisFromSheet } from "@/lib/kpis/intakeSheet";

export const dynamic = "force-dynamic";

function fmt(v: number) {
  return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0";
}

function fmtPct(v: number) {
  // If the sheet stores % as 0.23 (formatted as 23%), keep both cases readable.
  const n = Number(v);
  if (!Number.isFinite(n)) return "0%";
  const asPct = n <= 1 ? n * 100 : n;
  return `${Math.round(asPct * 10) / 10}%`;
}

export default async function IntakeKpisFromSheetPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const spreadsheetId = process.env.LG_INTAKE_KPI_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return (
      <div className="sw-page">
        <div className="sw-pageHeader">
          <h1 className="sw-h1">Intake KPIs (Google Sheet)</h1>
        </div>
        <div className="sw-card sw-card-pad" style={{ marginTop: 12, maxWidth: 820 }}>
          <div style={{ fontWeight: 900 }}>Missing config</div>
          <div className="sw-muted" style={{ marginTop: 8 }}>
            Set <code>LG_INTAKE_KPI_SPREADSHEET_ID</code> in Vercel env vars to the spreadsheetId for “Intake KPI&apos;s”.
          </div>
        </div>
      </div>
    );
  }

  const googleEmail = await getDefaultGoogleEmailForUser(session.user.email);
  if (!googleEmail) {
    return (
      <div className="sw-page">
        <div className="sw-pageHeader">
          <h1 className="sw-h1">Intake KPIs (Google Sheet)</h1>
        </div>
        <div className="sw-card sw-card-pad" style={{ marginTop: 12, maxWidth: 820 }}>
          <div style={{ fontWeight: 900 }}>No Google account connected</div>
          <div className="sw-muted" style={{ marginTop: 8 }}>
            Go to <a href="/settings/google">Settings → Google Workspace</a> and connect the Google account that has access
            to the sheet.
          </div>
        </div>
      </div>
    );
  }

  const year = new Date().getFullYear();
  const { sheetName, rows } = await getIntakeKpisFromSheet({
    googleEmail,
    spreadsheetId,
    year,
    sheetNameTemplate: process.env.LG_INTAKE_KPI_SHEETNAME_TEMPLATE || "{YYYY} Intake KPIs",
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.totalIntakeCalls += r.totalIntakeCalls;
      acc.designMeetingsHeld += r.designMeetingsHeld;
      acc.designMeetingsCancelled += r.designMeetingsCancelled;
      return acc;
    },
    { totalIntakeCalls: 0, designMeetingsHeld: 0, designMeetingsCancelled: 0 }
  );

  const latest = rows.length ? rows[rows.length - 1] : null;

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Intake KPIs (Google Sheet)</h1>
        <a className="sw-btn" href="/management/kpis/intake">
          DB summary →
        </a>
      </div>

      <p className="sw-muted" style={{ marginTop: 8 }}>
        Source: “Intake KPI&apos;s” → <strong>{sheetName}</strong> (via {googleEmail})
      </p>

      <div style={{ marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>YTD total intake calls</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{fmt(totals.totalIntakeCalls)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>YTD design meetings held</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{fmt(totals.designMeetingsHeld)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>YTD design meetings cancelled</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{fmt(totals.designMeetingsCancelled)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>Latest week</div>
          <div style={{ fontSize: 16, fontWeight: 900 }}>{latest ? latest.weekEnding : "—"}</div>
          <div className="sw-muted" style={{ marginTop: 8, fontSize: 12 }}>
            Calls: {latest ? fmt(latest.totalIntakeCalls) : "—"} · Held: {latest ? fmt(latest.designMeetingsHeld) : "—"} ·
            Cancelled: {latest ? fmt(latest.designMeetingsCancelled) : "—"} · Qualified: {latest ? fmtPct(latest.pctQualified) : "—"} ·
            Conversion: {latest ? fmt(latest.totalConversion) : "—"}
          </div>
        </div>
      </div>

      <div className="sw-card" style={{ marginTop: 14, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[
                "Week Ending",
                "Total Intake Calls",
                "Design Meetings HELD",
                "Design Meetings CANCELLED",
                "% Qualified",
                "Total Conversion",
              ].map((h) => (
                <th
                  key={h}
                  style={{ textAlign: "left", fontSize: 12, padding: "10px 12px", borderBottom: "1px solid var(--sw-border)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.weekEnding}>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--sw-border)", fontFamily: "var(--sw-mono)" }}>
                  {r.weekEnding}
                </td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--sw-border)" }}>{fmt(r.totalIntakeCalls)}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--sw-border)" }}>{fmt(r.designMeetingsHeld)}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--sw-border)" }}>{fmt(r.designMeetingsCancelled)}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--sw-border)" }}>{fmtPct(r.pctQualified)}</td>
                <td style={{ padding: "10px 12px", borderBottom: "1px solid var(--sw-border)" }}>{fmt(r.totalConversion)}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="sw-muted" colSpan={6} style={{ padding: "14px 12px" }}>
                  No weekly rows found (we filter to rows with a parseable “Week Ending” date).
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="sw-muted" style={{ marginTop: 10, fontSize: 12, maxWidth: 980 }}>
        Note: This view ignores subtotal/month rows by design and only reads rows with a real “Week Ending” date.
      </div>
    </div>
  );
}

