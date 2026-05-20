import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const completionSchema = z.number().int().min(0).max(100).refine((v) => v % 10 === 0, "completion must be in increments of 10");
const billingStatusSchema = z.enum(["BILLABLE", "BILLED", "NON_BILLABLE", "NO_CHARGE"]);
const patchTaskSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  assigneeUserId: z.string().min(1).optional(),
  matterId: z.string().min(1).nullable().optional(),
  deadline: z.string().trim().min(1).nullable().optional(),
  completionPercent: completionSchema.optional(),
  billingStatus: billingStatusSchema.optional(),
});

async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, activeFirmId: true },
  });
}

function parseDeadline(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.activeFirmId) return NextResponse.json({ error: "no active firm" }, { status: 400 });

  const { taskId } = await params;
  const parsed = patchTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "invalid task" }, { status: 400 });

  const existing = await prisma.task.findFirst({
    where: { id: taskId, firmId: user.activeFirmId },
    select: { id: true, title: true, description: true, matterId: true, billingStatus: true, completionPercent: true },
  });
  if (!existing) return NextResponse.json({ error: "task not found" }, { status: 404 });

  if (parsed.data.assigneeUserId) {
    const assignee = await prisma.firmMember.findUnique({
      where: { firmId_userId: { firmId: user.activeFirmId, userId: parsed.data.assigneeUserId } },
      select: { userId: true },
    });
    if (!assignee) return NextResponse.json({ error: "assignee must be a member of the active firm" }, { status: 400 });
  }

  if (parsed.data.matterId) {
    const matter = await prisma.matter.findFirst({ where: { id: parsed.data.matterId, firmId: user.activeFirmId }, select: { id: true } });
    if (!matter) return NextResponse.json({ error: "matter not found in active firm" }, { status: 400 });
  }

  const deadline = parseDeadline(parsed.data.deadline);
  if (deadline === false) return NextResponse.json({ error: "deadline must be a valid date" }, { status: 400 });

  const nextCompletion = parsed.data.completionPercent;
  const nextBillingStatus = parsed.data.billingStatus ?? existing.billingStatus;
  const nextMatterId = "matterId" in parsed.data ? parsed.data.matterId || null : existing.matterId;
  if (nextCompletion === 100 && nextBillingStatus === "BILLABLE" && !nextMatterId) {
    return NextResponse.json({ error: "billable tasks require a linked matter before completion" }, { status: 400 });
  }

  const data = {
    ...("title" in parsed.data ? { title: parsed.data.title } : {}),
    ...("description" in parsed.data ? { description: parsed.data.description } : {}),
    ...("assigneeUserId" in parsed.data ? { assigneeUserId: parsed.data.assigneeUserId } : {}),
    ...("matterId" in parsed.data ? { matterId: parsed.data.matterId || null } : {}),
    ...(deadline !== undefined ? { deadline } : {}),
    ...("billingStatus" in parsed.data ? { billingStatus: parsed.data.billingStatus } : {}),
    ...(nextCompletion !== undefined
      ? {
          completionPercent: nextCompletion,
          completedAt: nextCompletion === 100 ? new Date() : null,
        }
      : {}),
  };

  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      matter: { select: { id: true, displayName: true } },
    },
  });

  if (nextCompletion === 100 && existing.completionPercent < 100 && task.matter?.id) {
    await prisma.matterTimelineEvent.create({
      data: {
        firmId: user.activeFirmId,
        matterId: task.matter.id,
        actorUserId: user.id,
        eventType: "TASK_COMPLETED",
        title: `Task completed: ${task.title}`,
        body: task.description,
        relatedTaskId: task.id,
        details: { billingStatus: task.billingStatus, assigneeUserId: task.assigneeUser.id },
      },
    });
  }

  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.activeFirmId) return NextResponse.json({ error: "no active firm" }, { status: 400 });

  const { taskId } = await params;
  const existing = await prisma.task.findFirst({ where: { id: taskId, firmId: user.activeFirmId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "task not found" }, { status: 404 });

  await prisma.task.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
}
