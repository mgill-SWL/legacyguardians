import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ pipelineId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { pipelineId } = await ctx.params;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  const matters = await prisma.matter.findMany({
    where: {
      ...(q
        ? {
            displayName: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
      NOT: {
        pipelineLinks: {
          some: {
            pipelineId,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      displayName: true,
      primaryEmail: true,
      primaryPhone: true,
      estimatedValueCents: true,
    },
  });

  return NextResponse.json({ ok: true, matters });
}
