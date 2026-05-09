import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { invoiceNumber } from "@/lib/billing/invoiceNumbering";

export async function POST(_req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ error: "No active firm" }, { status: 400 });

  const { matterId } = await ctx.params;
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, firmId: true, primaryLocationId: true },
  });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  if (matter.firmId && matter.firmId !== user.activeFirmId) {
    return NextResponse.json({ error: "Matter not in active firm" }, { status: 403 });
  }
  if (!matter.firmId) {
    await prisma.matter.update({ where: { id: matter.id }, data: { firmId: user.activeFirmId } });
  }

  const firm = await prisma.firm.findUnique({ where: { id: user.activeFirmId }, select: { id: true, slug: true } });
  if (!firm) return NextResponse.json({ error: "Firm not found" }, { status: 404 });

  const now = new Date();
  const year = Number(now.getUTCFullYear());

  try {
    const result = await prisma.$transaction(async (tx) => {
    // Allocate invoice number (per firm per year)
    const seqRow = await tx.invoiceNumberSequence.upsert({
      where: { firmId_year: { firmId: firm.id, year } },
      create: { firmId: firm.id, year, nextSeq: 2 },
      update: { nextSeq: { increment: 1 } },
      select: { nextSeq: true },
    });
    const seq = seqRow.nextSeq - 1;
    const invNumber = invoiceNumber({ firmSlug: firm.slug, year, seq });

    const entries = await tx.timeEntry.findMany({
      where: { firmId: firm.id, matterId: matter.id, status: "DRAFT", billable: true, invoiceId: null },
      orderBy: [{ workDate: "asc" }, { createdAt: "asc" }],
    });

    if (!entries.length) {
      return { ok: false as const, error: "No uninvoiced timecards found" };
    }

    const invoice = await tx.invoice.create({
      data: {
        firmId: firm.id,
        matterId: matter.id,
        locationId: matter.primaryLocationId,
        status: "DRAFT",
        firmSlugAtIssue: firm.slug,
        invoiceYear: year,
        invoiceSeq: seq,
        invoiceNumber: invNumber,
        issueDate: null,
        dueDate: null,
        currency: "USD",
        createdByUserId: user.id,
      },
    });

    let subtotal = 0;
    let sortOrder = 0;

    for (const t of entries) {
      const isFlat = t.pricingMode === "FLAT";
      const quantityTenths = isFlat ? 0 : Math.round(t.durationMinutes / 6);
      const unitPriceCents = isFlat ? 0 : t.hourlyRateCents || 0;
      const amountCents = isFlat ? t.flatAmountCents || 0 : Math.round((quantityTenths * unitPriceCents) / 10);
      subtotal += amountCents;

      const line = await tx.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          lineType: "FEE",
          description: t.narrative,
          quantityTenths,
          unitPriceCents,
          amountCents,
          timeEntryId: t.id,
          sortOrder: sortOrder++,
        },
        select: { id: true },
      });

      await tx.timeEntry.update({
        where: { id: t.id },
        data: { invoiceId: invoice.id, invoiceLineId: line.id, status: "INVOICED" },
      });
    }

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { subtotalCents: subtotal, totalCents: subtotal },
    });

    return { ok: true as const, invoiceId: invoice.id, invoiceNumber: invNumber, lines: entries.length, subtotalCents: subtotal };
  });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
