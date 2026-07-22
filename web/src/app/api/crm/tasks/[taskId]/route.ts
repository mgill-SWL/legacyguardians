import { getServerSession } from "next-auth";
import type { CrmDisposition, CrmPriority, CrmTaskStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = new Set<string>(["OPEN", "IN_PROGRESS", "DONE"]);
const PRIORITIES = new Set<string>(["HOT", "WARM", "COLD"]);
const DISPOSITIONS = new Set<string>([
  "SCHEDULED_DISCOVERY",
  "INTERESTED_FOLLOW_UP",
  "NOT_INTERESTED",
  "NO_ANSWER_RETRY",
  "LEFT_VOICEMAIL",
  "WRONG_NUMBER",
  "DISQUALIFIED_JURISDICTION",
  "REFERRED_TO_OVERTURE",
  "BOOKING_LINK_SENT",
]);

export async function PATCH(req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { taskId } = await ctx.params;
  const task = await prisma.crmTask.findFirst({
    where: { id: taskId, contact: { OR: [{ firmId: user.activeFirmId }, { firmId: null }] } },
    select: { id: true },
  });
  if (!task) return NextResponse.json({ ok: false, error: "task not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    status?: unknown;
    priority?: unknown;
    disposition?: unknown;
    dueAt?: unknown;
    notes?: unknown;
  };

  const data: Prisma.CrmTaskUpdateInput = {};

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !STATUSES.has(body.status)) {
      return NextResponse.json({ ok: false, error: "invalid status" }, { status: 400 });
    }
    data.status = body.status as CrmTaskStatus;
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !PRIORITIES.has(body.priority)) {
      return NextResponse.json({ ok: false, error: "invalid priority" }, { status: 400 });
    }
    data.priority = body.priority as CrmPriority;
  }

  if (body.disposition !== undefined) {
    if (body.disposition === null || body.disposition === "") {
      data.disposition = null;
    } else if (typeof body.disposition !== "string" || !DISPOSITIONS.has(body.disposition)) {
      return NextResponse.json({ ok: false, error: "invalid disposition" }, { status: 400 });
    } else {
      data.disposition = body.disposition as CrmDisposition;
    }
  }

  if (body.dueAt !== undefined) {
    const parsed = new Date(String(body.dueAt));
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid due date" }, { status: 400 });
    }
    data.dueAt = parsed;
  }

  if (body.notes !== undefined) {
    data.notes = String(body.notes || "").trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "no fields to update" }, { status: 400 });
  }

  // Any staff action counts as a touch.
  data.lastTouchAt = new Date();

  const updated = await prisma.crmTask.update({
    where: { id: task.id },
    data,
    select: { id: true, status: true, priority: true, disposition: true, dueAt: true, notes: true, lastTouchAt: true },
  });

  return NextResponse.json({ ok: true, task: updated });
}
