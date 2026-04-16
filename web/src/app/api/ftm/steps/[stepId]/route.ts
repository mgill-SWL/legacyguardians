import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  howOwnerUserId?: string | null;
  ensureOwnerUserId?: string | null;
  doerUserId?: string | null;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ stepId: string }> }) {
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

  await prisma.ftmStep.update({
    where: { id: stepId },
    data: {
      howOwnerUserId: body?.howOwnerUserId ?? undefined,
      ensureOwnerUserId: body?.ensureOwnerUserId ?? undefined,
      doerUserId: body?.doerUserId ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
