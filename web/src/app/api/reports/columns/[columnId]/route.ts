import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isSuperAdmin(email: string | null | undefined) {
  const list = (process.env.LG_SUPER_ADMIN_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true; // default allow until configured
  return !!email && list.includes(email);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ columnId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  if (!isSuperAdmin(session.user.email)) return NextResponse.json({ ok: false, error: "super-admin required" }, { status: 403 });

  const { columnId } = await ctx.params;
  await prisma.reportColumn.delete({ where: { id: columnId } });
  return NextResponse.json({ ok: true });
}
