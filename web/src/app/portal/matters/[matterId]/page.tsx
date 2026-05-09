import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePortalSession, portalCanAccessMatter } from "@/lib/portalAccess";

export const dynamic = "force-dynamic";

export default async function PortalMatterHome({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const session = await requirePortalSession();
  if (!session) redirect("/portal");

  const { matterId } = await params;
  const access = await portalCanAccessMatter({ matterId, email: session.email });
  if (!access.ok) {
    return (
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 18px 64px" }}>
        <Link href="/portal" style={{ color: "var(--sw-muted)", textDecoration: "none" }}>
          ← Portal home
        </Link>
        <h1 style={{ marginTop: 14 }}>Access denied</h1>
        <p style={{ color: "var(--sw-muted)" }}>This matter is not associated with your email.</p>
      </main>
    );
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, displayName: true, updatedAt: true },
  });

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 18px 64px" }}>
      <Link href="/portal" style={{ color: "var(--sw-muted)", textDecoration: "none" }}>
        ← Portal home
      </Link>
      <h1 style={{ marginTop: 14, marginBottom: 6 }}>{matter?.displayName ?? "Matter"}</h1>
      <div style={{ color: "var(--sw-muted)", fontSize: 13 }}>Updated {matter?.updatedAt.toLocaleString()}</div>

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 800 }}>Forms</div>
        <Link
          href={`/portal/matters/${matterId}/epis`}
          style={{
            display: "block",
            padding: 12,
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid var(--sw-border)",
            background: "rgba(255,255,255,0.03)",
            textDecoration: "none",
            fontWeight: 800,
          }}
        >
          Estate Planning Information Sheet (EPIS) →
        </Link>
      </section>
    </main>
  );
}

