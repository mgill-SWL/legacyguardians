import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  key: string;
  channel: "EMAIL" | "SMS";
  name: string;
  subject?: string | null;
  body: string;
  attachmentUrl?: string | null;
  isHtml?: boolean;
};

function validChannel(channel: unknown): channel is Body["channel"] {
  return channel === "EMAIL" || channel === "SMS";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { activeFirmId: true } });
  const firmId = user?.activeFirmId;
  if (!firmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.key?.trim() || !body?.name?.trim() || !body?.body?.trim()) {
    return NextResponse.json({ ok: false, error: "key, name, body required" }, { status: 400 });
  }
  if (!validChannel(body.channel)) return NextResponse.json({ ok: false, error: "channel must be EMAIL or SMS" }, { status: 400 });

  const maxSortOrder = await prisma.messageTemplate.aggregate({
    where: { firmId },
    _max: { sortOrder: true },
  });

  const tpl = await prisma.messageTemplate.create({
    data: {
      firmId,
      key: body.key.trim(),
      channel: body.channel,
      name: body.name.trim(),
      subject: body.subject || null,
      body: body.body,
      attachmentUrl: body.attachmentUrl || null,
      isHtml: body.isHtml ?? false,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
    },
    select: { id: true, sortOrder: true },
  });

  return NextResponse.json({ ok: true, id: tpl.id, sortOrder: tpl.sortOrder });
}
