import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { name: string; description?: string };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.name?.trim()) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

  const count = await prisma.pipeline.count();

  const p = await prisma.pipeline.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      sortOrder: count,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: p.id });
}
