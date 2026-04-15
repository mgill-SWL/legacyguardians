import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { name?: string; description?: string };

export async function PATCH(req: Request, ctx: { params: Promise<{ pipelineId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { pipelineId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

  await prisma.pipeline.update({
    where: { id: pipelineId },
    data: { name: body.name.trim(), description: body.description?.trim() || null },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ pipelineId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { pipelineId } = await ctx.params;

  // Cascade will delete stages and matter links.
  await prisma.pipeline.delete({ where: { id: pipelineId } });

  return NextResponse.json({ ok: true });
}
