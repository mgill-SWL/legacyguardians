import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FtmHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });

  const maps = await prisma.ftmMap.findMany({
    orderBy: { updatedAt: "desc" },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>FTMs (Forever Task Maps)</h1>
        {user?.role === "ADMIN" ? (
          <Link href="/ftm/settings" style={{ color: "inherit" }}>
            Settings →
          </Link>
        ) : null}
      </div>

      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Editable by admins, readable by everyone.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {maps.map((m) => (
          <Link
            key={m.id}
            href={`/ftm/${m.id}`}
            style={{
              border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
              borderRadius: 14,
              padding: 14,
              background: "rgba(255,255,255,0.03)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 900 }}>{m.title}</div>
            <div style={{ marginTop: 6, color: "var(--sw-muted, #aab4d4)", fontSize: 12 }}>
              {m.steps.length} steps
            </div>
          </Link>
        ))}

        {maps.length === 0 ? (
          <div style={{ color: "var(--sw-muted, #aab4d4)" }}>No task maps yet.</div>
        ) : null}
      </div>
    </div>
  );
}
