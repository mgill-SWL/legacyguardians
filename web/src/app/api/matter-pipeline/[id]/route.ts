import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PatchBody = { stageId?: string; sortKey?: number };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, activeFirmId: true } });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;

  const link = await prisma.matterPipeline.findUnique({
    where: { id },
    include: {
      stage: { select: { id: true, name: true } },
      matter: { select: { id: true, firmId: true, displayName: true } },
      pipeline: { select: { name: true } },
    },
  });
  if (!link) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const firmId = link.firmId || link.matter.firmId || user.activeFirmId;
  if (link.matter.firmId && link.matter.firmId !== user.activeFirmId) {
    return NextResponse.json({ ok: false, error: "matter not in active firm" }, { status: 403 });
  }

  let nextStage: { id: string; name: string; pipelineId: string } | null = null;
  if (body?.stageId) {
    // Ensure stage belongs to same pipeline.
    const stage = await prisma.pipelineStage.findUnique({ where: { id: body.stageId } });
    if (!stage || stage.pipelineId !== link.pipelineId) {
      return NextResponse.json({ ok: false, error: "invalid stage" }, { status: 400 });
    }
    nextStage = stage;
  }

  await prisma.matterPipeline.update({
    where: { id },
    data: {
      stageId: body?.stageId || undefined,
      sortKey: body?.sortKey ?? undefined,
    },
  });

  if (nextStage && nextStage.id !== link.stageId) {
    await prisma.matterTimelineEvent.create({
      data: {
        firmId,
        matterId: link.matterId,
        actorUserId: user.id,
        eventType: "PIPELINE_STAGE_CHANGED",
        title: `Pipeline stage changed: ${link.stage.name} → ${nextStage.name}`,
        body: `${link.pipeline.name}: ${link.stage.name} → ${nextStage.name}`,
        relatedMatterPipelineId: link.id,
        details: {
          pipelineId: link.pipelineId,
          pipelineName: link.pipeline.name,
          fromStageId: link.stage.id,
          fromStageName: link.stage.name,
          toStageId: nextStage.id,
          toStageName: nextStage.name,
        },
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await prisma.matterPipeline.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
