import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  slug?: string;
  name?: string;
  durationMin?: number;
  startIntervalMin?: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  minNoticeHours?: number;
  rollingWeeks?: number;
  maxPerDay?: number;
};

const MIN_NOTICE_OPTIONS = new Set([0, 1, 6, 24]);

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const existing = await prisma.appointmentType.findUnique({ where: { id }, select: { ownerUserId: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const canEdit = user.role === "ADMIN" || (existing.ownerUserId && existing.ownerUserId === user.id);
  if (!canEdit) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
  const minNoticeHours = body.minNoticeHours === undefined ? undefined : Number(body.minNoticeHours);
  if (minNoticeHours !== undefined && !MIN_NOTICE_OPTIONS.has(minNoticeHours)) {
    return NextResponse.json({ ok: false, error: "minNoticeHours must be 0, 1, 6, or 24" }, { status: 400 });
  }

  const r = await prisma.appointmentType.updateMany({
    where: { id },
    data: {
      slug: body.slug?.trim() ? body.slug.trim() : undefined,
      name: body.name?.trim() ? body.name.trim() : undefined,
      durationMin: body.durationMin === undefined ? undefined : Number(body.durationMin),
      startIntervalMin: body.startIntervalMin === undefined ? undefined : Number(body.startIntervalMin),
      bufferBeforeMin: body.bufferBeforeMin === undefined ? undefined : Number(body.bufferBeforeMin),
      bufferAfterMin: body.bufferAfterMin === undefined ? undefined : Number(body.bufferAfterMin),
      minNoticeHours,
      rollingWeeks: body.rollingWeeks === undefined ? undefined : Number(body.rollingWeeks),
      maxPerDay: body.maxPerDay === undefined ? undefined : Number(body.maxPerDay),
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
  const existing = await prisma.appointmentType.findUnique({ where: { id }, select: { ownerUserId: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const canDelete = user.role === "ADMIN" || (existing.ownerUserId && existing.ownerUserId === user.id);
  if (!canDelete) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const r = await prisma.appointmentType.deleteMany({ where: { id } });
  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
