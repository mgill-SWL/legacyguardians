import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  displayName?: string | null;
  timeZone?: string;
  weekdayStartMin?: number;
  weekdayEndMin?: number;
  enabled?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const a = await prisma.appointmentAssignee.findUnique({ where: { id }, select: { typeId: true } });
  if (!a) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const type = await prisma.appointmentType.findUnique({ where: { id: a.typeId }, select: { ownerUserId: true } });
  const canEdit = user.role === "ADMIN" || (type?.ownerUserId && type.ownerUserId === user.id);
  if (!canEdit) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

  const r = await prisma.appointmentAssignee.updateMany({
    where: { id },
    data: {
      displayName: body.displayName === undefined ? undefined : body.displayName,
      timeZone: body.timeZone === undefined ? undefined : body.timeZone,
      weekdayStartMin: body.weekdayStartMin === undefined ? undefined : Number(body.weekdayStartMin),
      weekdayEndMin: body.weekdayEndMin === undefined ? undefined : Number(body.weekdayEndMin),
      enabled: body.enabled === undefined ? undefined : !!body.enabled,
    },
  });

  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const a = await prisma.appointmentAssignee.findUnique({ where: { id }, select: { typeId: true } });
  if (!a) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const type = await prisma.appointmentType.findUnique({ where: { id: a.typeId }, select: { ownerUserId: true } });
  const canDelete = user.role === "ADMIN" || (type?.ownerUserId && type.ownerUserId === user.id);
  if (!canDelete) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const r = await prisma.appointmentAssignee.deleteMany({ where: { id } });
  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
