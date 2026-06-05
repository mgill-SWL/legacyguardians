import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeFilename(name: string) {
  return name.replace(/[^\w.\- ()]/g, "_");
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { activeFirmId: true } });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;
  const template = await prisma.documentTemplate.findFirst({
    where: { id, firmId: user.activeFirmId },
    select: { sourceFileName: true, mimeType: true, content: true },
  });
  if (!template) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return new NextResponse(template.content as BodyInit, {
    headers: {
      "content-type": template.mimeType || "application/octet-stream",
      "content-disposition": `attachment; filename="${safeFilename(template.sourceFileName)}"`,
    },
  });
}
