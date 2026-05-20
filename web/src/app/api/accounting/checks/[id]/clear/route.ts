import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { email } });
  if (!actor?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: actor.activeFirmId, userId: actor.id } } });
  if (!canBookkeep({ userRole: actor.role, memberKind: member?.kind, memberRole: member?.role })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { rawTransactionId?: string } | null;
  const rawTransactionId = String(body?.rawTransactionId || "").trim();
  if (!rawTransactionId) return NextResponse.json({ ok: false, error: "rawTransactionId required" }, { status: 400 });

  const check = await prisma.operatingCheck.findUnique({ where: { id }, include: { financialAccount: true } });
  if (!check) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (check.firmId !== actor.activeFirmId) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (check.status === "VOID") return NextResponse.json({ ok: false, error: "cannot clear a VOID check" }, { status: 400 });

  const tx = await prisma.rawFinancialTransaction.findUnique({
    where: { id: rawTransactionId },
    include: { account: true },
  });
  if (!tx) return NextResponse.json({ ok: false, error: "transaction not found" }, { status: 404 });
  if (tx.firmId !== actor.activeFirmId) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (tx.direction !== "OUTFLOW") return NextResponse.json({ ok: false, error: "transaction must be an OUTFLOW" }, { status: 400 });
  if (tx.accountId !== check.financialAccountId) {
    return NextResponse.json({ ok: false, error: "transaction bank account does not match check bank account" }, { status: 400 });
  }

  // Safety: enforce amount match (you can relax this later if needed).
  if (Number(tx.amountCents) !== Number(check.amountCents)) {
    return NextResponse.json({ ok: false, error: "amount does not match" }, { status: 400 });
  }

  // Make sure this transaction isn't already used to clear another check.
  const already = await prisma.operatingCheck.findFirst({ where: { clearedRawTransactionId: tx.id } });
  if (already) return NextResponse.json({ ok: false, error: "transaction already linked to a check" }, { status: 409 });

  await prisma.operatingCheck.update({
    where: { id: check.id },
    data: {
      clearedRawTransactionId: tx.id,
      status: "CLEARED",
    },
  });

  return NextResponse.json({ ok: true });
}

