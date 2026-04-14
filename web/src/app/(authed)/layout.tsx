import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid var(--sw-border, #ddd)",
        textDecoration: "none",
        color: "inherit",
        fontWeight: 700,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      {label}
    </Link>
  );
}

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--sw-bg, #0b1020)",
        color: "var(--sw-text, #eef2ff)",
      }}
    >
      <aside
        style={{
          width: 280,
          padding: 16,
          borderRight: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ padding: "6px 6px 2px" }}>
          <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.2 }}>
            Legacy Guardians
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
            Staff console
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/crm/inbox" label="Inbox" />
          <NavLink href="/crm/queue" label="Queue" />
          <NavLink href="/crm/leads" label="Leads" />
          <NavLink href="/crm/reports/weekly" label="Weekly report" />
          <NavLink href="/settings/ringcentral" label="Integrations" />
          <NavLink href="/matters" label="Matters" />
        </div>

        <div style={{ marginTop: "auto", padding: 6 }}>
          <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)", marginBottom: 8 }}>
            Signed in as
            <div style={{ color: "var(--sw-text, #eef2ff)", fontWeight: 800, wordBreak: "break-word" }}>
              {session.user.email}
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
    </div>
  );
}
