import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

type Payload = {
  issueDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
};

export async function POST(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ error: "No active firm" }, { status: 400 });

  const { invoiceId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Payload | null;

  const issueDate = (body?.issueDate || new Date().toISOString().slice(0, 10)).trim();
  const dueDate = (body?.dueDate || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return NextResponse.json({ error: "issueDate must be YYYY-MM-DD" }, { status: 400 });
  }
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return NextResponse.json({ error: "dueDate must be YYYY-MM-DD" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, firmId: user.activeFirmId },
    include: { lines: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT invoices can be issued" }, { status: 400 });
  if (!invoice.lines.length) return NextResponse.json({ error: "Cannot issue an invoice with no lines" }, { status: 400 });
  if (invoice.totalCents <= 0) return NextResponse.json({ error: "Cannot issue an invoice with zero total" }, { status: 400 });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "ISSUED",
      issueDate: new Date(`${issueDate}T00:00:00.000Z`),
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
    },
  });

  return NextResponse.json({ ok: true });
}

