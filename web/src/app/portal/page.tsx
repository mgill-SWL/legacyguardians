import Link from "next/link";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { portalCookieName, verifyPortalSession } from "@/lib/portalSession";

import { PortalClient } from "./PortalClient";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const jar = await cookies();
  const session = verifyPortalSession(jar.get(portalCookieName())?.value);
  if (!session) return <PortalClient />;

  const email = session.email;

  // Best-effort: try JSON-path filtering; if it fails (older Prisma/Postgres behavior), fall back.
  let matters: Array<{ id: string; displayName: string; updatedAt: Date; createdAt: Date }> = [];
  try {
    const found = await prisma.matter.findMany({
      where: {
        intake: {
          is: {
            OR: [
              { data: { path: ["clientEmails", "client1"], equals: email } } as any,
              { data: { path: ["clientEmails", "client2"], equals: email } } as any,
            ],
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
      select: { id: true, displayName: true, updatedAt: true, createdAt: true },
    });
    matters = found;
  } catch {
    // Fallback: scan recent matters with intake.
    const recent = await prisma.matter.findMany({
      where: { intake: { isNot: null } },
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      select: { id: true, displayName: true, updatedAt: true, createdAt: true, intake: { select: { data: true } } },
    });
    matters = recent
      .filter((m) => {
        const d = (m.intake?.data ?? {}) as any;
        const e1 = String(d?.clientEmails?.client1 || "").toLowerCase().trim();
        const e2 = String(d?.clientEmails?.client2 || "").toLowerCase().trim();
        return e1 === email || e2 === email;
      })
      .slice(0, 50)
      .map((m) => ({ id: m.id, displayName: m.displayName, updatedAt: m.updatedAt, createdAt: m.createdAt }));
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 18px 64px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Client portal</h1>
          <div style={{ marginTop: 6, color: "var(--sw-muted)", fontSize: 13 }}>Signed in as {email}</div>
        </div>
        <form
          action="/api/portal/logout"
          method="post"
          style={{ margin: 0 }}
        >
          <button
            type="submit"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(255,255,255,0.04)",
              fontWeight: 700,
              color: "var(--sw-text)",
              cursor: "pointer",
            }}
          >
            Sign out
          </button>
        </form>
      </header>

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Your matters</div>
        {matters.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            {matters.map((m) => (
              <Link
                key={m.id}
                href={`/portal/matters/${m.id}`}
                style={{
                  display: "block",
                  padding: 12,
                  borderRadius: "var(--sw-radius-sm)",
                  border: "1px solid var(--sw-border)",
                  background: "rgba(255,255,255,0.03)",
                  textDecoration: "none",
                }}
              >
                <div style={{ fontWeight: 800 }}>{m.displayName}</div>
                <div style={{ marginTop: 4, color: "var(--sw-muted)", fontSize: 12 }}>
                  Updated {m.updatedAt.toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ color: "var(--sw-muted)" }}>No matters found for this email.</div>
        )}
      </section>
    </main>
  );
}

