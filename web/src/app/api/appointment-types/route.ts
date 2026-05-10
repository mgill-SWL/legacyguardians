import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  slug: string;
  name: string;
  durationMin: number;
  startIntervalMin?: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  minNoticeHours?: number;
  rollingWeeks?: number;
  maxPerDay?: number;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const types = await prisma.appointmentType.findMany({ include: { assignees: true }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ ok: true, types });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (!user.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.slug?.trim() || !body?.name?.trim()) {
    return NextResponse.json({ ok: false, error: "slug + name required" }, { status: 400 });
  }
  if (!Number.isFinite(body.durationMin) || body.durationMin <= 0) {
    return NextResponse.json({ ok: false, error: "durationMin required" }, { status: 400 });
  }

  const created = await prisma.appointmentType.create({
    data: {
      slug: body.slug.trim(),
      name: body.name.trim(),
      firmId: user.activeFirmId,
      ownerUserId: user.id,
      durationMin: Number(body.durationMin),
      startIntervalMin: Number(body.startIntervalMin ?? 15),
      bufferBeforeMin: Number(body.bufferBeforeMin ?? 0),
      bufferAfterMin: Number(body.bufferAfterMin ?? 0),
      minNoticeHours: Number(body.minNoticeHours ?? 24),
      rollingWeeks: Number(body.rollingWeeks ?? 6),
      maxPerDay: Number(body.maxPerDay ?? 6),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
