import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  key: string;
  label: string;
  group?: string | null;
  type?: "MONEY" | "TEXT" | "BOOLEAN" | "NUMBER";
  moneyCents?: number;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.key?.trim() || !body?.label?.trim()) return NextResponse.json({ ok: false, error: "key+label required" }, { status: 400 });

  const count = await prisma.feeFeature.count();

  const f = await prisma.feeFeature.create({
    data: {
      key: body.key.trim(),
      label: body.label.trim(),
      group: body.group || null,
      type: (body.type || "MONEY") as any,
      moneyCents: body.moneyCents ?? 0,
      sortOrder: count,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: f.id });
}
