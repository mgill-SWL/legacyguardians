import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as null | {
    displayName?: string;
    intake?: unknown;
  };

  if (!body?.displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 401 });

  const matter = await prisma.matter.create({
    data: {
      displayName: body.displayName,
      createdById: user.id,
      status: body.intake ? "INTAKE_IN_PROGRESS" : "DRAFT",
      intake: body.intake
        ? {
            create: {
              data: body.intake as unknown as object,
            },
          }
        : undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({ matterId: matter.id });
}
