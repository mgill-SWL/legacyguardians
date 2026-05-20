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

function usdSigned(cents: number, dir: "INFLOW" | "OUTFLOW") {
  const sign = dir === "OUTFLOW" ? -1 : 1;
  const n = (sign * (cents || 0)) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function BankAccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const account = await prisma.financialAccount.findFirst({ where: { id: accountId, firmId: user.activeFirmId } });
  if (!account) redirect("/management/accounting/banks");

  const raw = await prisma.rawFinancialTransaction.findMany({
    where: { firmId: user.activeFirmId, accountId: account.id },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: 250,
  });

  const checks = await prisma.operatingCheck.findMany({
    where: { firmId: user.activeFirmId, financialAccountId: account.id },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            {account.name}
          </h1>
          <div className="sw-muted">
            {account.kind} {account.institutionName ? `· ${account.institutionName}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="sw-btn" href="/management/accounting/banks">
            ← Banks
          </Link>
          <Link className="sw-btn sw-btnPrimary" href={`/management/accounting/banks/${account.id}/add/withdrawal`}>
            Add → Withdrawal
          </Link>
        </div>
      </div>

      <div className="sw-card sw-card-pad" style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900 }}>Recent checks</div>
        <div className="sw-muted" style={{ fontSize: 12, marginTop: 6 }}>
          Checks are stored as register entries and can be printed (v1 HTML print layout).
        </div>

        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table className="sw-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Date</th>
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
                  <td style={{ fontFamily: "var(--sw-mono)", fontWeight: 900 }}>{c.checkNumber || "To print"}</td>
                  <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.payeeName}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{(c.amountCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}</td>
                  <td>{c.status}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {c.toBePrinted ? (
                      <Link className="sw-btn sw-btnSm" href={`/management/accounting/checks/${c.id}/print`}>
                        Print
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="sw-muted" style={{ padding: 14 }}>
                    No checks yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Bank register (imported transactions)</div>
        <div style={{ overflowX: "auto" }}>
          <table className="sw-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Check #</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {raw.map((t) => {
                const rd = (t.rawData as Record<string, unknown>) || {};
                const cn = typeof rd["checkNumber"] === "string" ? (rd["checkNumber"] as string) : null;
                return (
                  <tr key={t.id}>
                    <td>{shortDate(t.transactionDate)}</td>
                    <td style={{ maxWidth: 560, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                    <td style={{ fontFamily: "var(--sw-mono)" }}>{cn || "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usdSigned(t.amountCents, t.direction)}</td>
                    <td style={{ fontFamily: "var(--sw-mono)", fontSize: 12 }}>{t.source}</td>
                  </tr>
                );
              })}
              {raw.length === 0 ? (
                <tr>
                  <td colSpan={5} className="sw-muted" style={{ padding: 14 }}>
                    No imported transactions yet for this account.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
