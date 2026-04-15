import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  displayName?: string;
  intake?: unknown;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { matterId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;

  if (!body?.displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  // Basic access check: must be a user.
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 401 });

  const updated = await prisma.matter.update({
    where: { id: matterId },
    data: {
      displayName: body.displayName,
      status: body.intake ? "INTAKE_IN_PROGRESS" : "DRAFT",
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
