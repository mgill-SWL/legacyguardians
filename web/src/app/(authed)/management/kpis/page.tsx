import Link from "next/link";

export const dynamic = "force-dynamic";

export default function KpisPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>KPIs</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #6b7280)" }}>Placeholder. Existing firm KPI pages:</p>
      <ul style={{ marginTop: 12, lineHeight: 1.6 }}>
        <li>
          <Link href="/crm/spend">Spend</Link>
        </li>
        <li>
          <Link href="/crm/reports/weekly">Weekly report</Link>
        </li>
      </ul>
    </div>
  );
}
