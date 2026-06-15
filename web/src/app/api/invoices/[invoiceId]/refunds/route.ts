import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

type Payload = {
  refundDate?: string; // YYYY-MM-DD
  amountUsd?: string;
  method?: "CHECK" | "ACH" | "WIRE" | "CASH" | "CARD" | "OTHER";
  reason?: "REFUND" | "CHARGEBACK";
  reference?: string;
  payerName?: string;
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

  const refundDate = (body?.refundDate || new Date().toISOString().slice(0, 10)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refundDate)) {
    return NextResponse.json({ error: "refundDate must be YYYY-MM-DD" }, { status: 400 });
  }

  const amountCents = parseMoneyCents(body?.amountUsd || "");
  if (!amountCents) return NextResponse.json({ error: "amountUsd is required" }, { status: 400 });

  const method = (body?.method || "OTHER") as Payload["method"];
  const reason = body?.reason || "REFUND";
  const reference = (body?.reference || "").trim() || null;
  const payerName = (body?.payerName || "").trim() || null;

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, firmId },
      include: { lines: true, allocations: true },
    });
    if (!invoice) return { ok: false as const, status: 404, error: "Invoice not found" };
    if (invoice.status === "VOID") return { ok: false as const, status: 400, error: "Cannot refund a VOID invoice" };

    // How much has been applied (net) so far?
    const appliedNet = invoice.allocations.reduce((sum, a) => sum + a.amountCents, 0);
    if (appliedNet <= 0) return { ok: false as const, status: 400, error: "Nothing has been paid on this invoice yet" };
    if (amountCents > appliedNet) {
      return { ok: false as const, status: 400, error: `Refund exceeds amount paid (${(appliedNet / 100).toFixed(2)})` };
    }

    const allocatedByLineId = invoice.allocations.reduce<Record<string, number>>((acc, a) => {
      if (!a.invoiceLineId) return acc;
      acc[a.invoiceLineId] = (acc[a.invoiceLineId] || 0) + a.amountCents;
      return acc;
    }, {});

    // Refund allocation defaults:
    // - reverse fees first (since refunds/chargebacks are usually fee-side)
    // - but don't exceed what has been allocated to each line
    const refundableLines = invoice.lines
      .map((l) => {
        const allocated = allocatedByLineId[l.id] || 0;
        const refundable = Math.max(0, Math.min(l.amountCents, allocated));
        return { ...l, refundable };
      })
      .filter((l) => l.refundable > 0)
      .sort((a, b) => {
        // fees first for refunds
        const rankA = a.lineType === "FEE" ? 0 : 1;
        const rankB = b.lineType === "FEE" ? 0 : 1;
        const r = rankA - rankB;
        if (r !== 0) return r;
        // then reverse newest lines last? keep simple: sortOrder
        return a.sortOrder - b.sortOrder;
      });

    let remaining = amountCents;
    const allocs: { invoiceLineId: string; amountCents: number }[] = [];
    for (const line of refundableLines) {
      if (remaining <= 0) break;
      const applied = Math.min(remaining, line.refundable);
      if (applied > 0) {
        allocs.push({ invoiceLineId: line.id, amountCents: -applied });
        remaining -= applied;
      }
    }

    if (remaining !== 0) return { ok: false as const, status: 500, error: "Refund allocation invariant failed" };

    const payment = await tx.payment.create({
      data: {
        firmId,
        receivedAt: new Date(`${refundDate}T00:00:00.000Z`),
        method: method || "OTHER",
        status: "POSTED",
        direction: "OUTFLOW",
        payerName,
        reference: reference ? `${reason}:${reference}` : reason,
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

    // If invoice was PAID, it may become ISSUED again.
    const newAppliedNet = appliedNet - amountCents;
    const newAllocatedTotal = newAppliedNet;
    const newOutstanding = invoice.totalCents - newAllocatedTotal;
    const nextStatus = newOutstanding <= 0 ? "PAID" : invoice.status === "PAID" ? "ISSUED" : invoice.status;
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: nextStatus } });

    return { ok: true as const, paymentId: payment.id, refundedCents: amountCents, newOutstandingCents: newOutstanding };
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
  return NextResponse.json(result);
}

