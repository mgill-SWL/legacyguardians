import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { clientIpFrom, consumeRateLimit, phoneKey, publicEndpointRules } from "@/lib/rateLimit";
import { sendAutomationSms } from "@/lib/ringcentralAutomation";
import { corsOptionsResponse, withCors } from "@/lib/webinarCors";
import { generate6DigitCode, hashCode } from "@/lib/webinarVerification";

export const dynamic = "force-dynamic";

type Body = {
  watchToken: string;
};

export async function OPTIONS(req: Request) {
  return corsOptionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.watchToken) {
    return withCors(NextResponse.json({ ok: false, error: "Missing watchToken" }, { status: 400 }), origin);
  }

  const reg = await prisma.crmRegistration.findFirst({
    where: { watchToken: body.watchToken },
    include: { contact: true, campaign: true },
  });

  if (!reg) {
    return withCors(NextResponse.json({ ok: false, error: "Invalid watchToken" }, { status: 400 }), origin);
  }

  if (!reg.contact.phoneVerifiedAt) {
    return withCors(NextResponse.json({ ok: false, error: "Phone not verified" }, { status: 403 }), origin);
  }

  // Unauthenticated endpoint that sends an SMS per request — rate limit per
  // phone, per IP, and globally to prevent SMS-pumping abuse.
  const allowed = await consumeRateLimit(
    publicEndpointRules("webinar-send-code", {
      contactKey: phoneKey(reg.contact.phoneE164),
      ip: clientIpFrom(req),
      perContactPerHour: 5,
    })
  );
  if (!allowed) {
    return withCors(
      NextResponse.json({ ok: false, error: "Too many code requests. Please try again later." }, { status: 429 }),
      origin
    );
  }

  const code = generate6DigitCode();
  const verification = await prisma.crmVerification.create({
    data: {
      purpose: "WATCH_ROOM",
      contactId: reg.contactId,
      registrationId: reg.id,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendAutomationSms(
    reg.contact.phoneE164,
    `Speedwell Law: your access code is ${code}. Reply STOP to opt out.`
  );

  return withCors(NextResponse.json({ ok: true, verificationId: verification.id }), origin);
}
