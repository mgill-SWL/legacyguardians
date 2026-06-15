import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import type { FirmMemberKind } from "@prisma/client";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { userId: string; kind: string };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!actor?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  // v1: only global ADMIN can edit firm roles.
  if (actor.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.userId || !body?.kind) return NextResponse.json({ ok: false, error: "userId + kind required" }, { status: 400 });

  const kind = body.kind as FirmMemberKind;

  const updated = await prisma.firmMember.updateMany({
    where: { firmId: actor.activeFirmId, userId: body.userId },
    data: { kind },
  });

  if (updated.count !== 1) return NextResponse.json({ ok: false, error: "membership not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

