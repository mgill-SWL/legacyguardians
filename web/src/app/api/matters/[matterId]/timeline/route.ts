import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const manualEventSchema = z.object({
  eventType: z.enum(["MANUAL_PHONE_CALL", "MANUAL_TEXT", "MANUAL_EMAIL", "MANUAL_MEETING", "MANUAL_INTERNAL_NOTE", "MANUAL_OTHER"]),
  title: z.string().trim().min(1).max(180),
  body: z.string().trim().max(5000).optional().nullable(),
  occurredAt: z.string().trim().optional().nullable(),
});

async function requireUserAndMatter(matterId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, activeFirmId: true } });
  if (!user) return { ok: false as const, status: 401, error: "user not found" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };

  const matter = await prisma.matter.findUnique({ where: { id: matterId }, select: { id: true, firmId: true } });
  if (!matter) return { ok: false as const, status: 404, error: "matter not found" };

  if (!matter.firmId) {
    await prisma.matter.update({ where: { id: matter.id }, data: { firmId: user.activeFirmId } });
  } else if (matter.firmId !== user.activeFirmId) {
    return { ok: false as const, status: 403, error: "matter not in active firm" };
  }

  return { ok: true as const, user, firmId: user.activeFirmId };
}

export async function POST(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await ctx.params;
  const access = await requireUserAndMatter(matterId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = manualEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "invalid timeline event" }, { status: 400 });

  let occurredAt = new Date();
  if (parsed.data.occurredAt) {
    occurredAt = new Date(parsed.data.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) return NextResponse.json({ error: "occurredAt must be a valid date/time" }, { status: 400 });
  }

  const event = await prisma.matterTimelineEvent.create({
    data: {
      firmId: access.firmId,
      matterId,
      actorUserId: access.user.id,
      eventType: parsed.data.eventType,
      title: parsed.data.title,
      body: parsed.data.body || null,
      occurredAt,
    },
    include: { actorUser: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ event });
}
