import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { dir: "up" | "down" };

export async function POST(req: Request, ctx: { params: Promise<{ stepId: string }> }) {
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

  const { stepId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.dir) return NextResponse.json({ ok: false, error: "dir required" }, { status: 400 });

  const step = await prisma.ftmStep.findUnique({ where: { id: stepId } });
  if (!step) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const neighbor = await prisma.ftmStep.findFirst({
    where: {
      mapId: step.mapId,
      sortOrder: body.dir === "up" ? { lt: step.sortOrder } : { gt: step.sortOrder },
    },
    orderBy: { sortOrder: body.dir === "up" ? "desc" : "asc" },
  });

  if (!neighbor) return NextResponse.json({ ok: true });

  await prisma.$transaction([
    prisma.ftmStep.update({ where: { id: step.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.ftmStep.update({ where: { id: neighbor.id }, data: { sortOrder: step.sortOrder } }),
  ]);

  return NextResponse.json({ ok: true });
}
