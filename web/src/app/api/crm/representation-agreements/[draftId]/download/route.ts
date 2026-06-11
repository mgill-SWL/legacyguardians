import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeFilename(name: string) {
  return name.replace(/[^\w.\- ()]/g, "_");
}

export async function GET(_req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { draftId } = await ctx.params;
  const draft = await prisma.representationAgreementDraft.findFirst({
    where: { id: draftId, firmId: user.activeFirmId },
    select: { fileName: true, mimeType: true, content: true },
  });
  if (!draft) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return new NextResponse(draft.content as BodyInit, {
    headers: {
      "content-type": draft.mimeType || "application/octet-stream",
      "content-disposition": `attachment; filename="${safeFilename(draft.fileName)}"`,
    },
  });
}
