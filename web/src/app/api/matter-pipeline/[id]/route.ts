import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PatchBody = { stageId?: string; sortKey?: number };

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;

  const link = await prisma.matterPipeline.findUnique({ where: { id } });
  if (!link) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  if (body?.stageId) {
    // Ensure stage belongs to same pipeline.
    const stage = await prisma.pipelineStage.findUnique({ where: { id: body.stageId } });
    if (!stage || stage.pipelineId !== link.pipelineId) {
      return NextResponse.json({ ok: false, error: "invalid stage" }, { status: 400 });
    }
  }

  await prisma.matterPipeline.update({
    where: { id },
    data: {
      stageId: body?.stageId || undefined,
      sortKey: body?.sortKey ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
