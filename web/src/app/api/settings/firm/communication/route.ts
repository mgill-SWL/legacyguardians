import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  emailFromName?: string | null;
  emailFromAddress?: string | null;
  emailReplyToAddress?: string | null;
  emailSendingDomain?: string | null;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function domainFromEmail(value: string) {
  return value.split("@")[1]?.toLowerCase() || "";
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!actor?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });
  if (actor.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const emailFromName = clean(body?.emailFromName);
  const emailFromAddress = clean(body?.emailFromAddress).toLowerCase();
  const emailReplyToAddress = clean(body?.emailReplyToAddress).toLowerCase();
  const emailSendingDomain = clean(body?.emailSendingDomain).toLowerCase() || domainFromEmail(emailFromAddress);

  if (!emailFromAddress || !isEmail(emailFromAddress)) return NextResponse.json({ ok: false, error: "valid from email is required" }, { status: 400 });
  if (emailReplyToAddress && !isEmail(emailReplyToAddress)) return NextResponse.json({ ok: false, error: "reply-to email is invalid" }, { status: 400 });

  await prisma.firm.update({
    where: { id: actor.activeFirmId },
    data: {
      emailFromName: emailFromName || null,
      emailFromAddress,
      emailReplyToAddress: emailReplyToAddress || null,
      emailSendingDomain: emailSendingDomain || null,
    },
  });

  return NextResponse.json({ ok: true });
}
