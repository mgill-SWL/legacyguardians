import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { sumLinesTotalCents } from "@/lib/billing/invoiceMath";

export async function DELETE(_req: Request, ctx: { params: Promise<{ invoiceId: string; lineId: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ error: "No active firm" }, { status: 400 });

  const { invoiceId, lineId } = await ctx.params;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, firmId: user.activeFirmId },
    include: { lines: true, allocations: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT invoices can be edited" }, { status: 400 });

  const line = invoice.lines.find((l) => l.id === lineId);
  if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 });
  if (line.timeEntryId) return NextResponse.json({ error: "Cannot delete timecard-linked lines" }, { status: 400 });

  const allocated = invoice.allocations
    .filter((a) => a.invoiceLineId === line.id)
    .reduce((sum, a) => sum + a.amountCents, 0);
  if (allocated > 0) return NextResponse.json({ error: "Cannot delete a line with allocations" }, { status: 400 });

  await prisma.invoiceLine.delete({ where: { id: line.id } });

  const remainingLines = invoice.lines.filter((l) => l.id !== line.id);
  const newTotal = sumLinesTotalCents(remainingLines);
  await prisma.invoice.update({ where: { id: invoice.id }, data: { subtotalCents: newTotal, totalCents: newTotal } });

  return NextResponse.json({ ok: true });
}

