import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { allocationOrderRank, sumLinesTotalCents } from "@/lib/billing/invoiceMath";

import { InvoiceClient } from "./ui";

export const dynamic = "force-dynamic";

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ matterId: string; invoiceId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const { matterId, invoiceId } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, firmId: user.activeFirmId, matterId },
    include: {
      matter: { select: { id: true, displayName: true } },
      lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      allocations: { include: { payment: true, invoiceLine: true }, orderBy: [{ createdAt: "asc" }] },
    },
  });
  if (!invoice) redirect(`/matters/${matterId}`);

  const allocatedTotal = invoice.allocations.reduce((sum, a) => sum + a.amountCents, 0);
  const outstanding = Math.max(0, invoice.totalCents - allocatedTotal);

  const allocatedByLineId = invoice.allocations.reduce<Record<string, number>>((acc, a) => {
    if (!a.invoiceLineId) return acc;
    acc[a.invoiceLineId] = (acc[a.invoiceLineId] || 0) + a.amountCents;
    return acc;
  }, {});

  const linesWithRemaining = invoice.lines
    .map((l) => {
      const allocated = allocatedByLineId[l.id] || 0;
      const remaining = Math.max(0, l.amountCents - allocated);
      return { ...l, allocatedCents: allocated, remainingCents: remaining };
    })
    .sort((a, b) => {
      const r = allocationOrderRank(a.lineType) - allocationOrderRank(b.lineType);
      if (r !== 0) return r;
      return a.sortOrder - b.sortOrder;
    });

  // Keep totals consistent if lines changed (safety belt)
  const computedTotal = sumLinesTotalCents(invoice.lines);
  const totalsMismatch = computedTotal !== invoice.totalCents;

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            Invoice {invoice.invoiceNumber}
          </h1>
          <div className="sw-muted">
            Matter: <Link href={`/matters/${invoice.matter.id}`}>{invoice.matter.displayName}</Link>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="sw-btn" href={`/matters/${invoice.matter.id}`}>
          ← Back to matter
        </Link>
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Status
          </div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>{invoice.status}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Total
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(invoice.totalCents)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Allocated
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(allocatedTotal)}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Outstanding
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{usd(outstanding)}</div>
        </div>
      </div>

      {totalsMismatch ? (
        <div style={{ marginTop: 12, color: "#ffb3c1" }}>
          Warning: invoice totals are out of sync with line sums (expected {usd(computedTotal)}). This will be fixed the next time you add/remove a line.
        </div>
      ) : null}

      <InvoiceClient
        invoice={{
          id: invoice.id,
          matterId: invoice.matterId,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          subtotalCents: invoice.subtotalCents,
          totalCents: invoice.totalCents,
          allocatedTotalCents: allocatedTotal,
          outstandingCents: outstanding,
          issueDate: invoice.issueDate ? invoice.issueDate.toISOString().slice(0, 10) : null,
          dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
        }}
        lines={linesWithRemaining.map((l) => ({
          id: l.id,
          lineType: l.lineType,
          description: l.description,
          quantityTenths: l.quantityTenths,
          unitPriceCents: l.unitPriceCents,
          amountCents: l.amountCents,
          sortOrder: l.sortOrder,
          timeEntryId: l.timeEntryId,
          allocatedCents: l.allocatedCents,
          remainingCents: l.remainingCents,
        }))}
        payments={Object.values(
          invoice.allocations.reduce<Record<
            string,
            {
              paymentId: string;
              receivedAt: string;
              method: string;
              direction: string;
              payerName: string | null;
              reference: string | null;
              amountCents: number;
              appliedCents: number;
            }
          >>((acc, a) => {
            const p = a.payment;
            if (!acc[p.id]) {
              acc[p.id] = {
                paymentId: p.id,
                receivedAt: p.receivedAt.toISOString().slice(0, 10),
                method: p.method,
                direction: p.direction,
                payerName: p.payerName,
                reference: p.reference,
                amountCents: p.amountCents,
                appliedCents: 0,
              };
            }
            acc[p.id].appliedCents += a.amountCents;
            return acc;
          }, {})
        ).sort((a, b) => (a.receivedAt < b.receivedAt ? 1 : -1))}
      />
    </div>
  );
}
