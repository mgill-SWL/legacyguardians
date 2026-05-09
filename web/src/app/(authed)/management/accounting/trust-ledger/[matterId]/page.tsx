import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { trustDeltaCents } from "@/lib/accounting/trust";

import { AddTrustTransaction } from "./AddTrustTransaction";

export const dynamic = "force-dynamic";

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function shortDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function MatterTrustLedgerPage({ params }: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const firmId = user?.activeFirmId || undefined;
  if (!firmId) redirect("/management/accounting/trust-ledger");

  const matter = await prisma.matter.findFirst({ where: { id: matterId, firmId } });
  if (!matter) redirect("/management/accounting/trust-ledger");

  const events = await prisma.matterFinancialEvent.findMany({
    where: {
      firmId,
      matterId,
      OR: [{ eventType: "TRUST_DEPOSIT" }, { eventType: "TRUST_APPLIED" }, { eventType: "TRANSFER" }, { eventType: "REFUND" }],
    },
    orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
  });

  const accountIds = Array.from(
    new Set(events.flatMap((e) => [e.fromAccountId, e.toAccountId]).filter((v): v is string => !!v))
  );
  const accounts = accountIds.length
    ? await prisma.billingAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, accountType: true } })
    : [];
  const accountTypeById = accounts.reduce<Record<string, any>>((acc, a) => {
    acc[a.id] = a.accountType;
    return acc;
  }, {});

  let running = 0;
  const rows = events.map((e) => {
    const delta = trustDeltaCents({
      eventType: e.eventType,
      amountCents: e.amountCents,
      fromAccountType: e.fromAccountId ? accountTypeById[e.fromAccountId] : null,
      toAccountType: e.toAccountId ? accountTypeById[e.toAccountId] : null,
    });
    running += delta;
    return { e, deltaCents: delta, balanceCents: running };
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            Trust ledger
          </h1>
          <div className="sw-muted">{matter.displayName}</div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="sw-btn" href="/management/accounting/trust-ledger">
          ← All matters
        </Link>
        <Link className="sw-btn" href="/management/accounting/trust-ledger/unmatched">
          Unmatched events →
        </Link>
      </div>

      <div className="sw-card sw-card-pad" style={{ marginTop: 16 }}>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Current trust balance
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(running)}</div>
      </div>

      <AddTrustTransaction matterId={matterId} />

      <div style={{ marginTop: 16 }}>
        {rows.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>Delta</th>
                <th style={{ textAlign: "right" }}>Balance</th>
                <th>Memo / source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, deltaCents, balanceCents }) => (
                <tr key={e.id}>
                  <td>{shortDate(e.eventDate)}</td>
                  <td>{e.eventType}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(deltaCents)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(balanceCents)}</td>
                  <td style={{ maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.notes || e.sourceReference || e.sourceInvoiceNumber || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sw-muted">No trust events linked to this matter yet.</div>
        )}
      </div>
    </div>
  );
}
