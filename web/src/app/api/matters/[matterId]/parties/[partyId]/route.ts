import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ matterId: string; partyId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { matterId, partyId } = await ctx.params;

  // Scope the delete to a party on a matter the firm can see.
  const party = await prisma.matterContact.findFirst({
    where: {
      id: partyId,
      matterId,
      matter: { OR: [{ firmId: user.activeFirmId }, { firmId: null }] },
    },
    select: { id: true },
  });
  if (!party) return NextResponse.json({ ok: false, error: "party not found" }, { status: 404 });

  await prisma.matterContact.delete({ where: { id: party.id } });
  return NextResponse.json({ ok: true });
}
