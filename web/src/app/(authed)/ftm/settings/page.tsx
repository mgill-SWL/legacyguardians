import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { FtmSettingsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function FtmSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== "ADMIN") redirect("/ftm");

  const maps = await prisma.ftmMap.findMany({
    orderBy: { updatedAt: "desc" },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });

  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    select: { id: true, email: true, name: true },
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>FTM settings (admin)</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Create maps and steps; assign owners/doers.
      </p>

      <FtmSettingsClient maps={maps} users={users} />
    </div>
  );
}
