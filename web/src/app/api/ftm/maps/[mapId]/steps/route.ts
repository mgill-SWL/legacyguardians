import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { name: string };

export async function POST(req: Request, ctx: { params: Promise<{ mapId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (user.role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount === 0) {
      await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    } else {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const { mapId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

  const max = await prisma.ftmStep.aggregate({
    where: { mapId },
    _max: { sortOrder: true },
  });
  const next = (max._max.sortOrder ?? -1) + 1;

  const s = await prisma.ftmStep.create({
    data: {
      mapId,
      name: body.name.trim(),
      sortOrder: next,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: s.id });
}
