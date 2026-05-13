import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

import { FirmSettingsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function FirmSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");
  const canAdmin = user.role === "ADMIN";

  const [firm, locations, users, firmMembers, locationMembers] = await Promise.all([
    prisma.firm.findUnique({ where: { id: user.activeFirmId }, select: { id: true, name: true, slug: true } }),
    prisma.firmLocation.findMany({
      where: { firmId: user.activeFirmId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, active: true },
    }),
    prisma.user.findMany({
      orderBy: [{ email: "asc" }],
      select: { id: true, email: true, name: true, defaultLocationId: true },
    }),
    prisma.firmMember.findMany({
      where: { firmId: user.activeFirmId },
      select: { userId: true, kind: true },
    }),
    prisma.firmLocationMember.findMany({
      where: { firmLocation: { firmId: user.activeFirmId } },
      select: { userId: true, firmLocationId: true },
    }),
  ]);

  const kindByUserId = firmMembers.reduce<Record<string, string>>((acc, m) => {
    acc[m.userId] = m.kind;
    return acc;
  }, {});

  const membershipByUserId = locationMembers.reduce<Record<string, string>>((acc, m) => {
    acc[m.userId] = m.firmLocationId;
    return acc;
  }, {});

  return (
    <FirmSettingsClient
      firm={firm}
      locations={locations}
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        locationId: membershipByUserId[u.id] || u.defaultLocationId || null,
        kind: kindByUserId[u.id] || "STAFF",
      }))}
      canAdmin={canAdmin}
    />
  );
}
