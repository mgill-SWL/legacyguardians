import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

type Payload = { userId?: string; locationId?: string | null };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { email } });
  if (!actor?.activeFirmId) return NextResponse.json({ error: "No active firm" }, { status: 400 });

  const json = (await request.json().catch(() => null)) as Payload | null;
  const userId = json?.userId;
  const locationId = json?.locationId ?? null;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  // Ensure user exists.
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!locationId) {
    // Unassign: remove membership + clear defaults.
    await prisma.firmLocationMember.deleteMany({ where: { userId } });
    await prisma.user.update({ where: { id: userId }, data: { defaultLocationId: null, activeLocationId: null } });
    return NextResponse.json({ ok: true });
  }

  const loc = await prisma.firmLocation.findFirst({ where: { id: locationId, firmId: actor.activeFirmId } });
  if (!loc) return NextResponse.json({ error: "Location not found for active firm" }, { status: 404 });

  await prisma.firmLocationMember.upsert({
    where: { userId },
    update: { firmLocationId: loc.id },
    create: { userId, firmLocationId: loc.id, role: "MEMBER" },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      defaultLocationId: loc.id,
      activeLocationId: loc.id,
    },
  });

  return NextResponse.json({ ok: true });
}

