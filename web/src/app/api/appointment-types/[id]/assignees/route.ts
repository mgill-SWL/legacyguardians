import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  googleEmail: string;
  displayName?: string | null;
  timeZone?: string;
  weekdayStartMin?: number;
  weekdayEndMin?: number;
  enabled?: boolean;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id: typeId } = await ctx.params;
  const type = await prisma.appointmentType.findUnique({ where: { id: typeId }, select: { ownerUserId: true } });
  if (!type) return NextResponse.json({ ok: false, error: "appointment type not found" }, { status: 404 });
  const canEdit = user.role === "ADMIN" || (type.ownerUserId && type.ownerUserId === user.id);
  if (!canEdit) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.googleEmail?.trim()) {
    return NextResponse.json({ ok: false, error: "googleEmail required" }, { status: 400 });
  }

  const created = await prisma.appointmentAssignee.create({
    data: {
      typeId,
      googleEmail: body.googleEmail.trim(),
      displayName: body.displayName || null,
      timeZone: body.timeZone || "America/New_York",
      weekdayStartMin: Number(body.weekdayStartMin ?? 9 * 60),
      weekdayEndMin: Number(body.weekdayEndMin ?? 17 * 60),
      enabled: body.enabled ?? true,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
