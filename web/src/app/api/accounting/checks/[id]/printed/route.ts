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

  // Only stamp printed for checks intended to be printed.
  if (!check.toBePrinted) return NextResponse.json({ ok: false, error: "check is not marked to be printed" }, { status: 400 });

  await prisma.operatingCheck.update({
    where: { id: check.id },
    data: {
      printedAt: check.printedAt ?? new Date(),
      printedByUserId: actor.id,
    },
  });

  return NextResponse.json({ ok: true });
}

