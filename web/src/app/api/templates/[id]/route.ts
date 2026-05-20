import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TemplateChannel = "EMAIL" | "SMS";

type Body = {
  key?: string;
  channel?: TemplateChannel;
  name?: string;
  subject?: string | null;
  body?: string;
  attachmentUrl?: string | null;
  isHtml?: boolean;
};

function validChannel(channel: unknown): channel is TemplateChannel {
  return channel === "EMAIL" || channel === "SMS";
}

async function requireActiveFirm() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, activeFirmId: true },
  });
  if (!user) return { ok: false as const, status: 401, error: "unauthorized" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };

  return { ok: true as const, firmId: user.activeFirmId, isAdmin: user.role === "ADMIN" };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireActiveFirm();
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
  if (body.channel !== undefined && !validChannel(body.channel)) {
    return NextResponse.json({ ok: false, error: "channel must be EMAIL or SMS" }, { status: 400 });
  }

  const r = await prisma.messageTemplate.updateMany({
    where: { id, firmId: access.firmId },
    data: {
      key: body.key?.trim() ? body.key.trim() : undefined,
      channel: body.channel,
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
  const access = await requireActiveFirm();
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  if (!access.isAdmin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const r = await prisma.messageTemplate.deleteMany({ where: { id, firmId: access.firmId } });
  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
