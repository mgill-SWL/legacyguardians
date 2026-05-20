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

function shortDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function OperatingChecksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const accounts = await prisma.financialAccount.findMany({
    where: { firmId: user.activeFirmId, active: true, kind: { in: ["OPERATING_BANK", "MONEY_MARKET", "TRUST_BANK", "OTHER"] } },
    orderBy: { name: "asc" },
  });

  const checks = await prisma.operatingCheck.findMany({
    where: { firmId: user.activeFirmId },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 250,
    include: { financialAccount: true },
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            Operating checks
          </h1>
          <div className="sw-muted">Check register (vendor checks). Create checks from any bank account; clear by matching bank CSV.</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="sw-btn" href="/management/accounting">
            ← Accounting
          </Link>
          <Link className="sw-btn sw-btnPrimary" href="/management/accounting/checks/new">
            New check
          </Link>
        </div>
      </div>

      <div className="sw-card sw-card-pad" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Bank accounts</div>
        <div className="sw-muted" style={{ fontSize: 12, marginTop: 6 }}>
          Checks can be created from any active operating-ish bank account. (Admin controls these under Financial Accounts.)
        </div>
        <ul style={{ marginTop: 10, lineHeight: 1.9 }}>
          {accounts.map((a) => (
            <li key={a.id}>
              <span style={{ fontFamily: "var(--sw-mono)", fontWeight: 900 }}>{a.name}</span> <span className="sw-muted">({a.kind})</span>
            </li>
          ))}
          {accounts.length === 0 ? <li className="sw-muted">No operating bank accounts yet.</li> : null}
        </ul>
      </div>

      <div style={{ marginTop: 16 }}>
        {checks.length ? (
          <table className="sw-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Check #</th>
                <th>Payee</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id}>
                  <td>{shortDate(c.issueDate)}</td>
                  <td>{c.financialAccount?.name ?? "—"}</td>
                  <td style={{ fontFamily: "var(--sw-mono)", fontWeight: 900 }}>{c.checkNumber || "To print"}</td>
                  <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.payeeName}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(c.amountCents)}</td>
                  <td>{c.status}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {c.toBePrinted ? (
                      <Link className="sw-btn sw-btnSm" href={`/management/accounting/checks/${c.id}/print`}>
                        Print
                      </Link>
                    ) : null}

                    {c.status !== "VOID" && !c.clearedRawTransactionId && (c.status === "ISSUED" || c.status === "DRAFT") ? (
                      <Link className="sw-btn sw-btnSm" href={`/management/accounting/checks/${c.id}/clear`}>
                        Clear…
                      </Link>
                    ) : (
                      <span className="sw-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sw-muted">No checks yet.</div>
        )}
      </div>
    </div>
  );
}
