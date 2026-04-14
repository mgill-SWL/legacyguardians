import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { corsOptionsResponse, withCors } from "@/lib/webinarCors";
import { hashCode } from "@/lib/webinarVerification";

export const dynamic = "force-dynamic";

type Body = {
  verificationId: string;
  code: string;
};

export async function OPTIONS(req: Request) {
  return corsOptionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.verificationId || !body?.code) {
    return withCors(NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 }), origin);
  }

  const v = await prisma.crmVerification.findUnique({
    where: { id: body.verificationId },
    include: { contact: true, registration: true },
  });

  if (!v || v.purpose !== "REGISTRATION") {
    return withCors(NextResponse.json({ ok: false, error: "Invalid verification" }, { status: 400 }), origin);
  }

  if (v.verifiedAt) {
    return withCors(NextResponse.json({ ok: true, watchToken: v.registration?.watchToken }), origin);
  }

  if (v.expiresAt.getTime() < Date.now()) {
    return withCors(NextResponse.json({ ok: false, error: "Code expired" }, { status: 400 }), origin);
  }

  if (v.attempts >= 5) {
    return withCors(NextResponse.json({ ok: false, error: "Too many attempts" }, { status: 429 }), origin);
  }

  const ok = hashCode(body.code.trim()) === v.codeHash;

  await prisma.crmVerification.update({
    where: { id: v.id },
    data: {
      attempts: { increment: 1 },
      verifiedAt: ok ? new Date() : undefined,
    },
  });

  if (!ok) {
    return withCors(NextResponse.json({ ok: false, error: "Invalid code" }, { status: 400 }), origin);
  }

  await prisma.crmContact.update({
    where: { id: v.contactId },
    data: { phoneVerifiedAt: new Date() },
  });

  if (v.registrationId) {
    await prisma.crmRegistration.update({
      where: { id: v.registrationId },
      data: { phoneVerifiedAt: new Date() },
    });
  }

  return withCors(NextResponse.json({ ok: true, watchToken: v.registration?.watchToken }), origin);
}
