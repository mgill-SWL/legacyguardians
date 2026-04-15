import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { title: string; description?: string };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.title?.trim()) return NextResponse.json({ ok: false, error: "title required" }, { status: 400 });

  const m = await prisma.ftmMap.create({
    data: {
      title: body.title.trim(),
      description: body.description?.trim() || undefined,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: m.id });
}
