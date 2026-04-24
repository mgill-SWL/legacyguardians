import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  key?: string;
  channel?: "EMAIL" | "SMS";
  name?: string;
  subject?: string | null;
  body?: string;
  attachmentUrl?: string | null;
  isHtml?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const firmId = user.activeFirmId;
  if (!firmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

  const r = await prisma.messageTemplate.updateMany({
    where: { id, firmId },
    data: {
      key: body.key?.trim() ? body.key.trim() : undefined,
      channel: body.channel as any,
      name: body.name?.trim() ? body.name.trim() : undefined,
      subject: body.subject === undefined ? undefined : body.subject,
      body: body.body === undefined ? undefined : body.body,
      attachmentUrl: body.attachmentUrl === undefined ? undefined : body.attachmentUrl,
      isHtml: body.isHtml === undefined ? undefined : body.isHtml,
    },
  });

  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const firmId = user.activeFirmId;
  if (!firmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;
  const r = await prisma.messageTemplate.deleteMany({ where: { id, firmId } });
  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
