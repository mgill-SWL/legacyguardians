import Link from "next/link";

export const dynamic = "force-dynamic";

function Tile({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: 18,
        borderRadius: 14,
        border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
        background: "rgba(255,255,255,0.03)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
      <div style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)", lineHeight: 1.35 }}>{desc}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Dashboard</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)", maxWidth: 900 }}>
        MVP staff console. The immediate focus is the webinar follow-up inbox + queue (RingCentral).
      </p>

      <div
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <Tile title="Inbox" desc="View and reply to inbound SMS/MMS for the dedicated texting number." href="/crm/inbox" />
        <Tile title="Queue" desc="Work follow-up tasks with dispositions and scheduling." href="/crm/queue" />
        <Tile title="Integrations" desc="Connect RingCentral per user." href="/settings/ringcentral" />
      </div>
    </div>
  );
}
