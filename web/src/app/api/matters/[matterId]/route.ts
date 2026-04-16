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

  const updated = await prisma.matter.update({
    where: { id: matterId },
    data: {
      displayName: body.displayName ? body.displayName : undefined,
      primaryEmail: body.primaryEmail === undefined ? undefined : body.primaryEmail,
      primaryPhone: body.primaryPhone === undefined ? undefined : body.primaryPhone,
      estimatedValueCents: body.estimatedValueCents === undefined ? undefined : body.estimatedValueCents,
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
