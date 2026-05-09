import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function daysBetween(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default async function AccountsReceivablePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const invoices = await prisma.invoice.findMany({
    where: {
      firmId: user.activeFirmId,
      status: { in: ["DRAFT", "ISSUED"] },
    },
    include: {
      matter: { select: { id: true, displayName: true, primaryLocation: { select: { slug: true } } } },
      allocations: { select: { amountCents: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 400,
  });

  const today = new Date();

  const rows = invoices
    .map((inv) => {
      const allocated = inv.allocations.reduce((sum, a) => sum + a.amountCents, 0);
      const outstanding = Math.max(0, inv.totalCents - allocated);
      const anchor = inv.dueDate || inv.issueDate || inv.createdAt;
      const ageDays = daysBetween(today, anchor);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        matterId: inv.matterId,
        matterName: inv.matter.displayName,
        locationSlug: inv.matter.primaryLocation?.slug || "—",
        totalCents: inv.totalCents,
        allocatedCents: allocated,
        outstandingCents: outstanding,
        ageDays,
      };
    })
    .filter((r) => r.outstandingCents > 0);

  const buckets = rows.reduce(
    (acc, r) => {
      const d = r.ageDays;
      if (d <= 0) acc.current += r.outstandingCents;
      else if (d <= 30) acc.d1_30 += r.outstandingCents;
      else if (d <= 60) acc.d31_60 += r.outstandingCents;
      else if (d <= 90) acc.d61_90 += r.outstandingCents;
      else acc.d90p += r.outstandingCents;
      acc.total += r.outstandingCents;
      return acc;
    },
    { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, total: 0 }
  );

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Accounts receivable</h1>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="sw-btn" href="/management/accounting">
          ← Accounting
        </Link>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Current
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(buckets.current)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            1–30
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(buckets.d1_30)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            31–60
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(buckets.d31_60)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            61–90
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(buckets.d61_90)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            90+
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(buckets.d90p)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Total A/R
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(buckets.total)}</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {rows.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Matter</th>
                <th>Loc</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Outstanding</th>
                <th style={{ textAlign: "right" }}>Age (days)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/matters/${r.matterId}/invoices/${r.id}`}>{r.invoiceNumber}</Link>
                  </td>
                  <td>
                    <Link href={`/matters/${r.matterId}`}>{r.matterName}</Link>
                  </td>
                  <td>{r.locationSlug}</td>
                  <td>{r.status}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(r.outstandingCents)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.ageDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sw-muted">No outstanding invoices 🎉</div>
        )}
      </div>
    </div>
  );
}

