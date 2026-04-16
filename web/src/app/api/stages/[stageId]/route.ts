import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PatchBody = { name?: string; colorHex?: string | null };

export async function PATCH(req: Request, ctx: { params: Promise<{ stageId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { stageId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;

  await prisma.pipelineStage.update({
    where: { id: stageId },
    data: {
      name: body?.name?.trim() ? body.name.trim() : undefined,
      colorHex: body?.colorHex === undefined ? undefined : body.colorHex,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ stageId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { stageId } = await ctx.params;
  await prisma.pipelineStage.delete({ where: { id: stageId } });

  return NextResponse.json({ ok: true });
}
