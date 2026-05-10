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

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

  const r = await prisma.appointmentType.updateMany({
    where: { id },
    data: {
      slug: body.slug?.trim() ? body.slug.trim() : undefined,
      name: body.name?.trim() ? body.name.trim() : undefined,
      durationMin: body.durationMin === undefined ? undefined : Number(body.durationMin),
      startIntervalMin: body.startIntervalMin === undefined ? undefined : Number(body.startIntervalMin),
      bufferBeforeMin: body.bufferBeforeMin === undefined ? undefined : Number(body.bufferBeforeMin),
      bufferAfterMin: body.bufferAfterMin === undefined ? undefined : Number(body.bufferAfterMin),
      minNoticeHours: body.minNoticeHours === undefined ? undefined : Number(body.minNoticeHours),
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
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const r = await prisma.appointmentType.deleteMany({ where: { id } });
  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

