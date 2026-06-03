import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  direction?: "up" | "down";
};

async function requireActiveFirm() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user) return { ok: false as const, status: 401, error: "unauthorized" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };

  return { ok: true as const, firmId: user.activeFirmId };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireActiveFirm();
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (body?.direction !== "up" && body?.direction !== "down") {
    return NextResponse.json({ ok: false, error: "direction must be up or down" }, { status: 400 });
  }

  const templates = await prisma.messageTemplate.findMany({
    where: { firmId: access.firmId },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    select: { id: true, sortOrder: true },
  });
  const currentIndex = templates.findIndex((template) => template.id === id);
  if (currentIndex === -1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const swapIndex = body.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const current = templates[currentIndex];
  const swap = templates[swapIndex];
  if (!swap) return NextResponse.json({ ok: true });

  await prisma.$transaction([
    prisma.messageTemplate.update({
      where: { id: current.id },
      data: { sortOrder: swap.sortOrder },
    }),
    prisma.messageTemplate.update({
      where: { id: swap.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
