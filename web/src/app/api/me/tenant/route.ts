import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PatchBody = {
  activeFirmId?: string;
  activeLocationId?: string | null;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      activeFirmId: true,
      activeLocationId: true,
      firmMemberships: {
        select: {
          role: true,
          firm: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });

  const firms = user.firmMemberships.map((m) => ({ ...m.firm, role: m.role }));
  const activeFirmId = user.activeFirmId || firms[0]?.id || null;

  const locations = activeFirmId
    ? await prisma.firmLocation.findMany({
        where: { firmId: activeFirmId, active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true },
      })
    : [];

  return NextResponse.json({
    ok: true,
    firms,
    activeFirmId,
    locations,
    activeLocationId: user.activeLocationId,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, firmMemberships: { select: { firmId: true } } },
  });
  if (!user) return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

  let nextFirmId: string | undefined;
  if (body.activeFirmId !== undefined) {
    const allowed = user.firmMemberships.some((m) => m.firmId === body.activeFirmId);
    if (!allowed) return NextResponse.json({ ok: false, error: "not a member of that firm" }, { status: 403 });
    nextFirmId = body.activeFirmId;
  }

  let nextLocationId: string | null | undefined = body.activeLocationId;

  // If firm changes and location is not explicitly provided, default to first active location.
  if (nextFirmId && body.activeLocationId === undefined) {
    const first = await prisma.firmLocation.findFirst({
      where: { firmId: nextFirmId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true },
    });
    nextLocationId = first?.id || null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      activeFirmId: nextFirmId,
      activeLocationId: nextLocationId,
    },
  });

  return NextResponse.json({ ok: true });
}
