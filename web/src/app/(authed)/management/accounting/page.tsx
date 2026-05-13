import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const reportLabel: Record<string, string> = {
  COLLECTIONS_BY_TIMEKEEPER: "Collections by Timekeeper",
  BILLINGS_BY_TIMEKEEPER: "Billings by Timekeeper",
  TRUST_RECEIPTS_JOURNAL: "Trust Receipts Journal",
  TRUST_DISBURSEMENTS_JOURNAL: "Trust Disbursements Journal",
  INVOICE_PAYMENT_ALLOCATIONS: "Invoice Payment Allocations",
  OPERATING_RETAINER_BY_MATTER: "Operating Retainer by Matter",
};

function shortDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AccountingHubPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const firmId = user?.activeFirmId || undefined;

  const recentBatches = await prisma.kpiImportBatch.findMany({
    where: firmId ? { firmId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const batchCounts = recentBatches.reduce<Record<string, number>>((acc, b) => {
    acc[b.reportType] = (acc[b.reportType] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Accounting</h1>
      </div>

      <p className="sw-muted" style={{ marginTop: 8 }}>
        Current “bookkeeping” in LG is mostly import/KPI plumbing (CosmoLex reports → normalized financial events). The trust ledger,
        three-way reconciliation, and CosmoLex push/export workflow are still in progress.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="sw-card sw-card-pad">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Imports (working)</h2>
          <ul style={{ marginTop: 10, lineHeight: 1.9 }}>
            <li>
              <Link href="/admin/imports/cosmolex">CosmoLex KPI import</Link>
            </li>
            <li>
              <Link href="/admin/imports/invoice-payment-allocations">Invoice Payment Allocations</Link>
            </li>
            <li>
              <Link href="/admin/imports/trust-receipts">Trust Receipts Journal</Link>
            </li>
            <li>
              <Link href="/admin/imports/trust-disbursements">Trust Disbursements Journal</Link>
            </li>
            <li>
              <Link href="/admin/imports/operating-retainer">Operating Retainer by Matter</Link>
            </li>
          </ul>
        </div>

        <div className="sw-card sw-card-pad">
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Accounting workspaces (next)</h2>
          <ul style={{ marginTop: 10, lineHeight: 1.9 }}>
            <li>
              <Link href="/management/accounting/inbox">Bookkeeping inbox</Link> (review/classify raw bank/card activity)
            </li>
            <li>
              <Link href="/management/accounting/coa">Chart of accounts</Link> (COA import)
            </li>
            <li>
              <Link href="/management/accounting/payee-rules">Payee rules</Link> (auto-suggest COA by vendor)
            </li>
            <li>
              <Link href="/management/accounting/ar">Accounts receivable</Link> (open invoices, aging)
            </li>
            <li>
              <Link href="/management/accounting/trust-ledger">Trust ledger</Link> (running balances, no-negative guardrail)
            </li>
            <li>
              <Link href="/management/accounting/reconciliation">Three-way reconciliation</Link> (monthly, auditable)
            </li>
          </ul>
        </div>

        <div className="sw-card sw-card-pad" style={{ gridColumn: "1 / -1" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Recent import batches</h2>
          {recentBatches.length ? (
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table className="sw-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Report</th>
                    <th>Status</th>
                    <th>Filename</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBatches.map((b) => (
                    <tr key={b.id}>
                      <td>{shortDate(b.createdAt)}</td>
                      <td>{reportLabel[b.reportType] ?? b.reportType}</td>
                      <td>{b.status}</td>
                      <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.sourceFilename ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sw-muted" style={{ marginTop: 10 }}>
              No import batches yet.
            </div>
          )}

          {Object.keys(batchCounts).length ? (
            <div className="sw-muted" style={{ marginTop: 10, fontSize: 12 }}>
              In the last {recentBatches.length} batches: {Object.entries(batchCounts)
                .map(([k, n]) => `${reportLabel[k] ?? k} (${n})`)
                .join(" · ")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
