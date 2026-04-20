import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { key: string; label: string; type?: "TEXT" | "NUMBER" | "CURRENCY" | "PERCENT" | "DATE" };

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.key?.trim() || !body?.label?.trim()) return NextResponse.json({ ok: false, error: "key+label required" }, { status: 400 });

  const table = await prisma.reportTable.findUnique({ where: { slug } });
  if (!table) return NextResponse.json({ ok: false, error: "table not found" }, { status: 404 });

  const max = await prisma.reportColumn.aggregate({ where: { tableId: table.id }, _max: { sortOrder: true } });
  const next = (max._max.sortOrder ?? -1) + 1;

  const col = await prisma.reportColumn.create({
    data: {
      tableId: table.id,
      key: body.key.trim(),
      label: body.label.trim(),
      type: body.type || "TEXT",
      sortOrder: next,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: col.id });
}
