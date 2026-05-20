import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  displayName?: string;
  intake?: unknown;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  estimatedValueCents?: number;
  intakeSpecialistId?: string | null;
  leadAttorneyId?: string | null;
  primaryLocationId?: string | null;
  referralSourceContactId?: string | null;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { matterId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });

  // Basic access check: must be a user.
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 401 });

  if (!user.activeFirmId) return NextResponse.json({ error: "no active firm" }, { status: 400 });

  const matter = await prisma.matter.findUnique({ where: { id: matterId }, select: { id: true, firmId: true } });
  if (!matter) return NextResponse.json({ error: "matter not found" }, { status: 404 });

  // v1: backfill firmId on first touch.
  if (!matter.firmId) {
    await prisma.matter.update({ where: { id: matter.id }, data: { firmId: user.activeFirmId } });
  } else if (matter.firmId !== user.activeFirmId) {
    return NextResponse.json({ error: "matter not in active firm" }, { status: 403 });
  }

  let primaryLocationId: string | null | undefined = undefined;
  if (body.primaryLocationId !== undefined) {
    if (body.primaryLocationId === null) {
      primaryLocationId = null;
    } else {
      const loc = await prisma.firmLocation.findFirst({ where: { id: body.primaryLocationId, firmId: user.activeFirmId } });
      if (!loc) return NextResponse.json({ error: "invalid primaryLocationId" }, { status: 400 });
      primaryLocationId = loc.id;
    }
  }

  let referralSourceContactId: string | null | undefined = undefined;
  if (body.referralSourceContactId !== undefined) {
    if (body.referralSourceContactId === null) {
      referralSourceContactId = null;
    } else {
      const contact = await prisma.contact.findFirst({ where: { id: body.referralSourceContactId, firmId: user.activeFirmId } });
      if (!contact) return NextResponse.json({ error: "invalid referralSourceContactId" }, { status: 400 });
      referralSourceContactId = contact.id;
    }
  }

  const updated = await prisma.matter.update({
    where: { id: matterId },
    data: {
      displayName: body.displayName ? body.displayName : undefined,
      primaryEmail: body.primaryEmail === undefined ? undefined : body.primaryEmail,
      primaryPhone: body.primaryPhone === undefined ? undefined : body.primaryPhone,
      estimatedValueCents: body.estimatedValueCents === undefined ? undefined : body.estimatedValueCents,
      intakeSpecialistId: body.intakeSpecialistId === undefined ? undefined : body.intakeSpecialistId,
      leadAttorneyId: body.leadAttorneyId === undefined ? undefined : body.leadAttorneyId,
      primaryLocationId,
      referralSourceContactId,
      status: body.intake ? "INTAKE_IN_PROGRESS" : undefined,
      intake: body.intake
        ? {
            upsert: {
              create: { data: body.intake as object },
              update: { data: body.intake as object },
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({ matterId: updated.id });
}
