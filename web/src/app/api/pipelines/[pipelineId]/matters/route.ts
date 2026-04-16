import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { matterId: string; stageId?: string };

export async function POST(req: Request, ctx: { params: Promise<{ pipelineId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { pipelineId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.matterId) return NextResponse.json({ ok: false, error: "matterId required" }, { status: 400 });

  const stage = body.stageId
    ? await prisma.pipelineStage.findUnique({ where: { id: body.stageId } })
    : await prisma.pipelineStage.findFirst({ where: { pipelineId }, orderBy: { sortOrder: "asc" } });

  if (!stage || stage.pipelineId !== pipelineId) {
    return NextResponse.json({ ok: false, error: "no stage found" }, { status: 400 });
  }

  try {
    const link = await prisma.matterPipeline.create({
      data: {
        pipelineId,
        matterId: body.matterId,
        stageId: stage.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: link.id });
  } catch (e: any) {
    // unique(matterId,pipelineId)
    return NextResponse.json({ ok: false, error: "already in pipeline" }, { status: 409 });
  }
}
