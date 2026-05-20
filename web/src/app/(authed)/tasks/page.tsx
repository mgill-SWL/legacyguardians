import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { TasksClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, activeFirmId: true },
  });
  if (!user?.activeFirmId) redirect("/dashboard");

  const [members, matters, tasks] = await Promise.all([
    prisma.firmMember.findMany({
      where: { firmId: user.activeFirmId },
      orderBy: { user: { email: "asc" } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.matter.findMany({
      where: { firmId: user.activeFirmId },
      orderBy: { updatedAt: "desc" },
      take: 250,
      select: { id: true, displayName: true },
    }),
    prisma.task.findMany({
      where: { firmId: user.activeFirmId },
      orderBy: [{ completionPercent: "asc" }, { deadline: "asc" }, { createdAt: "desc" }],
      take: 250,
      include: {
        assigneeUser: { select: { id: true, name: true, email: true } },
        createdByUser: { select: { id: true, name: true, email: true } },
        matter: { select: { id: true, displayName: true } },
      },
    }),
  ]);

  return (
    <TasksClient
      currentUserId={user.id}
      users={members.map((m) => m.user).filter(Boolean)}
      matters={matters}
      initialTasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        deadline: t.deadline ? t.deadline.toISOString() : null,
        completionPercent: t.completionPercent,
        billingStatus: t.billingStatus,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        assigneeUser: t.assigneeUser,
        createdByUser: t.createdByUser,
        matter: t.matter,
      }))}
    />
  );
}
