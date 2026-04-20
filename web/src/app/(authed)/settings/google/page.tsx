import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function GoogleSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canAdmin = user?.role === "ADMIN";

  const connections = await prisma.googleConnection.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Google Workspace</h1>
        <Link className="sw-btn sw-btnPrimary" href="/api/google/oauth/start">
          Connect Google
        </Link>
      </div>

      <p className="sw-muted" style={{ marginTop: 8 }}>
        Connect one or more Google accounts (welcome@ for email sending, intake specialists for calendar booking).
      </p>

      {!canAdmin ? (
        <div className="sw-card sw-card-pad" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 900 }}>Note</div>
          <div className="sw-muted" style={{ marginTop: 8 }}>
            Any user can connect their Google account. Admins will control which connected accounts are used for booking and
            automated email.
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 820 }}>
        {connections.map((c) => (
          <div key={c.id} className="sw-card sw-card-pad">
            <div style={{ fontWeight: 900 }}>{c.googleEmail}</div>
            <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
              Updated: {c.updatedAt.toISOString().slice(0, 19).replace("T", " ")}
            </div>
          </div>
        ))}
        {connections.length === 0 ? <div className="sw-muted">No Google accounts connected yet.</div> : null}
      </div>

      <div className="sw-muted" style={{ marginTop: 16, fontSize: 12 }}>
        Required env vars: GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET.
      </div>
    </div>
  );
}
