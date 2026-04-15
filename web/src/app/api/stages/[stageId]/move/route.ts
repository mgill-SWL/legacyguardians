import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { dir: "up" | "down" };

export async function POST(req: Request, ctx: { params: Promise<{ stageId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { stageId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.dir) return NextResponse.json({ ok: false, error: "dir required" }, { status: 400 });

  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId } });
  if (!stage) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const neighbor = await prisma.pipelineStage.findFirst({
    where: {
      pipelineId: stage.pipelineId,
      sortOrder: body.dir === "up" ? { lt: stage.sortOrder } : { gt: stage.sortOrder },
    },
    orderBy: { sortOrder: body.dir === "up" ? "desc" : "asc" },
  });

  if (!neighbor) return NextResponse.json({ ok: true });

  await prisma.$transaction([
    prisma.pipelineStage.update({ where: { id: stage.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.pipelineStage.update({ where: { id: neighbor.id }, data: { sortOrder: stage.sortOrder } }),
  ]);

  return NextResponse.json({ ok: true });
}
