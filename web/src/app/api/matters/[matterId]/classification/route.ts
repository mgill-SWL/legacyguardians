import { getServerSession } from "next-auth";
import type { PracticeArea } from "@prisma/client";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { PRACTICE_AREA_VALUES } from "@/lib/matter/practiceArea";

export const dynamic = "force-dynamic";

function parseArea(value: unknown): PracticeArea | null {
  if (typeof value !== "string" || !value) return null;
  return PRACTICE_AREA_VALUES.has(value) ? (value as PracticeArea) : null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { matterId } = await ctx.params;
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, OR: [{ firmId: user.activeFirmId }, { firmId: null }] },
    select: { id: true },
  });
  if (!matter) return NextResponse.json({ ok: false, error: "matter not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    practiceArea?: unknown;
    litigationSubjectArea?: unknown;
  };

  if (body.practiceArea !== undefined && body.practiceArea !== null && body.practiceArea !== "" && !parseArea(body.practiceArea)) {
    return NextResponse.json({ ok: false, error: "invalid practice area" }, { status: 400 });
  }

  const practiceArea = parseArea(body.practiceArea);
  // The litigation subject only applies to litigation matters.
  const litigationSubjectArea = practiceArea === "LITIGATION" ? parseArea(body.litigationSubjectArea) : null;

  const updated = await prisma.matter.update({
    where: { id: matter.id },
    data: { practiceArea, litigationSubjectArea },
    select: { id: true, practiceArea: true, litigationSubjectArea: true },
  });

  return NextResponse.json({ ok: true, matter: updated });
}
