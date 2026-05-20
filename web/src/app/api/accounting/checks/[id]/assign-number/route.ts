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

async function allocateNextCheckNumber({ firmId, financialAccountId }: { firmId: string; financialAccountId: string }) {
  // Compare-and-swap loop on the per-account sequence.
  // Default starting number: 1001.
  const DEFAULT_START = 1001;

  // Ensure sequence row exists.
  await prisma.financialAccountCheckSequence.upsert({
    where: { financialAccountId },
    update: {},
    create: { firmId, financialAccountId, nextNumber: DEFAULT_START },
  });

  for (let i = 0; i < 10; i++) {
    const seq = await prisma.financialAccountCheckSequence.findUnique({ where: { financialAccountId } });
    const n = seq?.nextNumber ?? DEFAULT_START;

    const updated = await prisma.financialAccountCheckSequence.updateMany({
      where: { financialAccountId, nextNumber: n },
      data: { nextNumber: n + 1 },
    });

    if (updated.count === 1) return String(n);
  }

  throw new Error("Could not allocate next check number (contention)");
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const check = await prisma.operatingCheck.findUnique({ where: { id } });
  if (!check) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (check.firmId !== actor.activeFirmId) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!check.toBePrinted) return NextResponse.json({ ok: false, error: "check is not marked to be printed" }, { status: 400 });

  // Idempotent: if already assigned, return it.
  if (check.checkNumber) return NextResponse.json({ ok: true, checkNumber: check.checkNumber });

  // Allocate + set with retry in case of a rare uniqueness conflict.
  for (let i = 0; i < 5; i++) {
    const next = await allocateNextCheckNumber({ firmId: actor.activeFirmId, financialAccountId: check.financialAccountId });
    try {
      await prisma.operatingCheck.update({
        where: { id: check.id },
        data: { checkNumber: next },
      });
      return NextResponse.json({ ok: true, checkNumber: next });
    } catch {
      // Likely uniqueness conflict; retry.
      continue;
    }
  }

  return NextResponse.json({ ok: false, error: "failed to assign check number" }, { status: 500 });
}

