import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function requireUserAndMatter(matterId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return { ok: false as const, status: 401, error: "user not found" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };

  const matter = await prisma.matter.findUnique({ where: { id: matterId }, select: { id: true, firmId: true } });
  if (!matter) return { ok: false as const, status: 404, error: "matter not found" };

  // v1: backfill firmId on first touch.
  if (!matter.firmId) {
    await prisma.matter.update({ where: { id: matter.id }, data: { firmId: user.activeFirmId } });
  } else if (matter.firmId !== user.activeFirmId) {
    return { ok: false as const, status: 403, error: "matter not in active firm" };
  }

  return { ok: true as const, user, matter };
}

export async function GET(_req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await ctx.params;
  const r = await requireUserAndMatter(matterId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, displayName: true, intake: { select: { data: true, updatedAt: true } } },
  });
  if (!matter?.intake?.data) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    matterId: matter.id,
    displayName: matter.displayName,
    updatedAt: matter.intake.updatedAt,
    intake: matter.intake.data,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await ctx.params;
  const r = await requireUserAndMatter(matterId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = (await req.json().catch(() => null)) as null | { intake?: unknown };
  const intake = body?.intake as any;
  if (!intake || typeof intake !== "object") return NextResponse.json({ error: "intake required" }, { status: 400 });

  const updated = await prisma.matter.update({
    where: { id: matterId },
    data: {
      status: "INTAKE_IN_PROGRESS",
      intake: {
        upsert: {
          create: { data: intake },
          update: { data: intake },
        },
      },
    },
    select: { intake: { select: { updatedAt: true } } },
  });

  return NextResponse.json({ ok: true, updatedAt: updated.intake?.updatedAt ?? null });
}

