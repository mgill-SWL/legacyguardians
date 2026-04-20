import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { label: string };

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { slug } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.label?.trim()) return NextResponse.json({ ok: false, error: "label required" }, { status: 400 });

  const table = await prisma.reportTable.findUnique({ where: { slug } });
  if (!table) return NextResponse.json({ ok: false, error: "table not found" }, { status: 404 });

  const count = await prisma.reportRow.count({ where: { tableId: table.id } });

  const row = await prisma.reportRow.create({
    data: {
      tableId: table.id,
      label: body.label.trim(),
      rowKey: slugify(body.label) || `row-${Date.now()}`,
      sortOrder: count,
      data: {},
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: row.id });
}
