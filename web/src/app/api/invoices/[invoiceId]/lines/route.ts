import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { sumLinesTotalCents } from "@/lib/billing/invoiceMath";

type Payload = {
  lineType?: "ADVANCED_CLIENT_COST" | "FEE";
  description?: string;
  amountUsd?: string;
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

  const { invoiceId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Payload | null;

  const lineType = body?.lineType || "ADVANCED_CLIENT_COST";
  const description = (body?.description || "").trim();
  const amountCents = parseMoneyCents(body?.amountUsd || "");

  if (!description) return NextResponse.json({ error: "description is required" }, { status: 400 });
  if (!amountCents) return NextResponse.json({ error: "amountUsd is required" }, { status: 400 });

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, firmId: user.activeFirmId },
    include: { lines: true },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT invoices can be edited" }, { status: 400 });

  const sortOrder = invoice.lines.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1;

  const line = await prisma.invoiceLine.create({
    data: {
      invoiceId: invoice.id,
      lineType,
      description,
      quantityTenths: 0,
      unitPriceCents: 0,
      amountCents,
      sortOrder,
    },
    select: { id: true },
  });

  const newTotal = sumLinesTotalCents([...invoice.lines, { amountCents }]);
  await prisma.invoice.update({ where: { id: invoice.id }, data: { subtotalCents: newTotal, totalCents: newTotal } });

  return NextResponse.json({ ok: true, id: line.id });
}

