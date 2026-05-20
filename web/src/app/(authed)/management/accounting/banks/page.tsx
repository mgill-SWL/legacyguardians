import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

export default async function BanksIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const accounts = await prisma.financialAccount.findMany({
    where: { firmId: user.activeFirmId, active: true },
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            Banks
          </h1>
          <div className="sw-muted">Bank accounts + register. Next: deposits/withdrawals, check printing, and running balances.</div>
        </div>
        <Link className="sw-btn" href="/management/accounting">
          ← Accounting
        </Link>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table className="sw-table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>Account</th>
              <th>Kind</th>
              <th>Institution</th>
              <th>Last 4</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 900 }}>{a.name}</td>
                <td style={{ fontFamily: "var(--sw-mono)" }}>{a.kind}</td>
                <td>{a.institutionName || "—"}</td>
                <td style={{ fontFamily: "var(--sw-mono)" }}>{a.last4 || "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="sw-btn sw-btnSm" href={`/management/accounting/banks/${a.id}`}>
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="sw-muted" style={{ padding: 14 }}>
                  No financial accounts yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

