import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { key: string; value: string };

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string; rowId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { rowId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.key) return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });

  const row = await prisma.reportRow.findUnique({ where: { id: rowId } });
  if (!row) return NextResponse.json({ ok: false, error: "row not found" }, { status: 404 });

  const data = (row.data as any) || {};
  data[body.key] = body.value;

  await prisma.reportRow.update({ where: { id: rowId }, data: { data } });

  return NextResponse.json({ ok: true });
}
