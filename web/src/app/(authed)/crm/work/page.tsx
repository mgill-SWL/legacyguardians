import Link from "next/link";

export const dynamic = "force-dynamic";

function Tab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
        background: "rgba(255,255,255,0.03)",
        textDecoration: "none",
        color: "inherit",
        fontWeight: 900,
      }}
    >
      {label}
    </Link>
  );
}

export default async function CrmWorkPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>CRM Work</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Operator workspace. Next step is to merge Inbox + Queue into a single split/tabs view.
      </p>

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Tab href="/crm/inbox" label="Inbox" />
        <Tab href="/crm/queue" label="Queue" />
      </div>
    </div>
  );
}
