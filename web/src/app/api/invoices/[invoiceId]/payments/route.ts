import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { allocationOrderRank } from "@/lib/billing/invoiceMath";

type Payload = {
  receivedDate?: string; // YYYY-MM-DD
  amountUsd?: string;
  method?: "CHECK" | "ACH" | "WIRE" | "CASH" | "CARD" | "OTHER";
  payerName?: string;
  reference?: string;
};

function parseMoneyCents(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export async function POST(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ error: "No active firm" }, { status: 400 });

  const firmId = user.activeFirmId;

  const { invoiceId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Payload | null;
  const receivedDate = (body?.receivedDate || "").trim();
  const method = (body?.method || "OTHER") as Payload["method"];
  const payerName = (body?.payerName || "").trim() || null;
  const reference = (body?.reference || "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedDate)) {
    return NextResponse.json({ error: "receivedDate must be YYYY-MM-DD" }, { status: 400 });
  }
  const amountCents = parseMoneyCents(body?.amountUsd || "");
  if (!amountCents) return NextResponse.json({ error: "amountUsd is required" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, firmId },
      include: { lines: true, allocations: true },
    });
    if (!invoice) return { ok: false as const, status: 404, error: "Invoice not found" };
    if (invoice.status === "VOID") return { ok: false as const, status: 400, error: "Cannot post payment to VOID invoice" };

    const allocatedTotal = invoice.allocations.reduce((sum, a) => sum + a.amountCents, 0);
    const outstanding = invoice.totalCents - allocatedTotal;
    if (outstanding <= 0) return { ok: false as const, status: 400, error: "Invoice is already fully allocated" };
    if (amountCents > outstanding) {
      return { ok: false as const, status: 400, error: `Payment exceeds outstanding balance (${(outstanding / 100).toFixed(2)})` };
    }

    const allocatedByLineId = invoice.allocations.reduce<Record<string, number>>((acc, a) => {
      if (!a.invoiceLineId) return acc;
      acc[a.invoiceLineId] = (acc[a.invoiceLineId] || 0) + a.amountCents;
      return acc;
    }, {});

    const orderedLines = invoice.lines
      .map((l) => {
        const allocated = allocatedByLineId[l.id] || 0;
        const remaining = Math.max(0, l.amountCents - allocated);
        return { ...l, remaining };
      })
      .filter((l) => l.remaining > 0)
      .sort((a, b) => {
        const r = allocationOrderRank(a.lineType) - allocationOrderRank(b.lineType);
        if (r !== 0) return r;
        return a.sortOrder - b.sortOrder;
      });

    let remainingPayment = amountCents;
    const allocs: { invoiceLineId: string; amountCents: number }[] = [];

    for (const line of orderedLines) {
      if (remainingPayment <= 0) break;
      const applied = Math.min(remainingPayment, line.remaining);
      if (applied > 0) {
        allocs.push({ invoiceLineId: line.id, amountCents: applied });
        remainingPayment -= applied;
      }
    }

    if (remainingPayment !== 0) {
      return { ok: false as const, status: 500, error: "Allocation invariant failed" };
    }

    const payment = await tx.payment.create({
      data: {
        firmId,
        receivedAt: new Date(`${receivedDate}T00:00:00.000Z`),
        method: method || "OTHER",
        status: "POSTED",
        direction: "INFLOW",
        payerName,
        reference,
        amountCents,
        currency: invoice.currency,
        createdByUserId: user.id,
      },
      select: { id: true },
    });

    for (const a of allocs) {
      await tx.paymentAllocation.create({
        data: {
          firmId,
          paymentId: payment.id,
          invoiceId: invoice.id,
          invoiceLineId: a.invoiceLineId,
          amountCents: a.amountCents,
        },
      });
    }

    const newAllocatedTotal = allocatedTotal + amountCents;
    const newOutstanding = invoice.totalCents - newAllocatedTotal;

    // Progress invoice status automatically (minimal v1): DRAFT -> ISSUED when first payment posted.
    const nextStatus = newOutstanding <= 0 ? "PAID" : invoice.status === "DRAFT" ? "ISSUED" : invoice.status;
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        status: nextStatus,
        issueDate: invoice.issueDate || (invoice.status === "DRAFT" ? new Date(`${receivedDate}T00:00:00.000Z`) : undefined),
      },
    });

    return { ok: true as const, paymentId: payment.id, appliedCents: amountCents, newOutstandingCents: newOutstanding };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: (result as any).status || 400 });
  return NextResponse.json(result);
}
