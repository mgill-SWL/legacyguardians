import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { name: string };

export async function POST(req: Request, ctx: { params: Promise<{ pipelineId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { pipelineId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

  const max = await prisma.pipelineStage.aggregate({
    where: { pipelineId },
    _max: { sortOrder: true },
  });
  const next = (max._max.sortOrder ?? -1) + 1;

  const stage = await prisma.pipelineStage.create({
    data: {
      pipelineId,
      name: body.name.trim(),
      sortOrder: next,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: stage.id });
}
