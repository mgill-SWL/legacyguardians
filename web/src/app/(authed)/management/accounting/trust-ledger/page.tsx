import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { trustDeltaCents } from "@/lib/accounting/trust";

export const dynamic = "force-dynamic";

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function TrustLedgerIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const firmId = user?.activeFirmId || undefined;

  if (!firmId) {
    return (
      <div className="sw-page">
        <div className="sw-pageHeader">
          <h1 className="sw-h1">Trust ledger</h1>
        </div>
        <p className="sw-muted" style={{ marginTop: 8 }}>
          Signed-in user has no active firm.
        </p>
      </div>
    );
  }

  const matters = await prisma.matter.findMany({
    where: { firmId },
    select: { id: true, displayName: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const trustEvents = await prisma.matterFinancialEvent.findMany({
    where: {
      firmId,
      OR: [{ eventType: "TRUST_DEPOSIT" }, { eventType: "TRUST_APPLIED" }, { eventType: "TRANSFER" }, { eventType: "REFUND" }],
    },
    select: { matterId: true, eventType: true, amountCents: true, fromAccountId: true, toAccountId: true },
  });

  const accountIds = Array.from(
    new Set(
      trustEvents
        .flatMap((e) => [e.fromAccountId, e.toAccountId])
        .filter((v): v is string => !!v)
    )
  );

  const accounts = accountIds.length
    ? await prisma.billingAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, accountType: true } })
    : [];
  const accountTypeById = accounts.reduce<Record<string, any>>((acc, a) => {
    acc[a.id] = a.accountType;
    return acc;
  }, {});

  const balancesByMatterId = trustEvents.reduce<Record<string, number>>((acc, e) => {
    const matterId = e.matterId;
    if (!matterId) return acc;
    acc[matterId] =
      (acc[matterId] || 0) +
      trustDeltaCents({
        eventType: e.eventType,
        amountCents: e.amountCents,
        fromAccountType: e.fromAccountId ? accountTypeById[e.fromAccountId] : null,
        toAccountType: e.toAccountId ? accountTypeById[e.toAccountId] : null,
      });
    return acc;
  }, {});

  const rows = matters
    .map((m) => ({ id: m.id, displayName: m.displayName, balanceCents: balancesByMatterId[m.id] || 0 }))
    .filter((m) => m.balanceCents !== 0)
    .sort((a, b) => Math.abs(b.balanceCents) - Math.abs(a.balanceCents));

  const unmatchedCount = trustEvents.filter((e) => !e.matterId).length;

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Trust ledger</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Matter-level trust balances computed from imported trust events. Next: make “unmatched” events linkable to a matter, and add manual
        trust transaction entry with no-negative-balance enforcement.
      </p>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="sw-btn" href="/management/accounting/trust-ledger/unmatched">
          Unmatched trust events ({unmatchedCount}) →
        </Link>
      </div>

      <div style={{ marginTop: 16 }}>
        {rows.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th>Matter</th>
                <th style={{ textAlign: "right" }}>Trust balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/management/accounting/trust-ledger/${r.id}`}>{r.displayName}</Link>
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(r.balanceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sw-muted">No trust balances yet (or all are zero).</div>
        )}
      </div>
    </div>
  );
}
