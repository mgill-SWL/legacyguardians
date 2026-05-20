import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const completionSchema = z.number().int().min(0).max(100).refine((v) => v % 10 === 0, "completion must be in increments of 10");
const billingStatusSchema = z.enum(["BILLABLE", "BILLED", "NON_BILLABLE", "NO_CHARGE"]);

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(5000),
  assigneeUserId: z.string().min(1),
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
  if (!value) return null;
  const parsed = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.activeFirmId) return NextResponse.json({ error: "no active firm" }, { status: 400 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") || "open";
  const assigneeUserId = url.searchParams.get("assigneeUserId") || undefined;
  const matterId = url.searchParams.get("matterId") || undefined;

  const tasks = await prisma.task.findMany({
    where: {
      firmId: user.activeFirmId,
      ...(scope === "open" ? { completionPercent: { lt: 100 } } : {}),
      ...(assigneeUserId ? { assigneeUserId } : {}),
      ...(matterId ? { matterId } : {}),
    },
    orderBy: [{ completionPercent: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
    take: 250,
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      matter: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({ tasks });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.activeFirmId) return NextResponse.json({ error: "no active firm" }, { status: 400 });

  const parsed = createTaskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "invalid task" }, { status: 400 });

  const deadline = parseDeadline(parsed.data.deadline);
  if (deadline === undefined) return NextResponse.json({ error: "deadline must be a valid date" }, { status: 400 });

  const assignee = await prisma.firmMember.findUnique({
    where: { firmId_userId: { firmId: user.activeFirmId, userId: parsed.data.assigneeUserId } },
    select: { userId: true },
  });
  if (!assignee) return NextResponse.json({ error: "assignee must be a member of the active firm" }, { status: 400 });

  if (parsed.data.matterId) {
    const matter = await prisma.matter.findFirst({ where: { id: parsed.data.matterId, firmId: user.activeFirmId }, select: { id: true } });
    if (!matter) return NextResponse.json({ error: "matter not found in active firm" }, { status: 400 });
  }

  const completionPercent = parsed.data.completionPercent ?? 0;
  const billingStatus = parsed.data.billingStatus ?? "NON_BILLABLE";
  if (completionPercent === 100 && billingStatus === "BILLABLE" && !parsed.data.matterId) {
    return NextResponse.json({ error: "billable tasks require a linked matter before completion" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      firmId: user.activeFirmId,
      matterId: parsed.data.matterId || null,
      title: parsed.data.title,
      description: parsed.data.description,
      deadline,
      completionPercent,
      billingStatus,
      completedAt: completionPercent === 100 ? new Date() : null,
      createdByUserId: user.id,
      assigneeUserId: parsed.data.assigneeUserId,
    },
    include: {
      assigneeUser: { select: { id: true, name: true, email: true } },
      createdByUser: { select: { id: true, name: true, email: true } },
      matter: { select: { id: true, displayName: true } },
    },
  });

  if (task.matter?.id) {
    await prisma.matterTimelineEvent.create({
      data: {
        firmId: user.activeFirmId,
        matterId: task.matter.id,
        actorUserId: user.id,
        eventType: "TASK_CREATED",
        title: `Task created: ${task.title}`,
        body: task.description,
        relatedTaskId: task.id,
        details: { billingStatus: task.billingStatus, assigneeUserId: task.assigneeUser.id },
      },
    });
  }

  return NextResponse.json({ task });
}
