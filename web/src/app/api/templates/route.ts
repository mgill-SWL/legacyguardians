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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.key?.trim() || !body?.name?.trim() || !body?.body?.trim()) {
    return NextResponse.json({ ok: false, error: "key, name, body required" }, { status: 400 });
  }

  const tpl = await prisma.messageTemplate.create({
    data: {
      key: body.key.trim(),
      channel: body.channel,
      name: body.name.trim(),
      subject: body.subject || null,
      body: body.body,
      attachmentUrl: body.attachmentUrl || null,
      isHtml: body.isHtml ?? false,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: tpl.id });
}
