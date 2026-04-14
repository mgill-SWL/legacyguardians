import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizeE164 } from "@/lib/ringcentral";
import { sendAutomationSms } from "@/lib/ringcentralAutomation";
import { corsOptionsResponse, withCors } from "@/lib/webinarCors";
import { generate6DigitCode, generateWatchToken, hashCode } from "@/lib/webinarVerification";

export const dynamic = "force-dynamic";

type Body = {
  campaignSlug: string;
  showingId?: string;
  showingStartsAt?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
};

export async function OPTIONS(req: Request) {
  return corsOptionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.campaignSlug || !body.firstName || !body.lastName || !body.phone) {
    return withCors(NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 }), origin);
  }

  const phoneE164 = normalizeE164(body.phone);
  if (!phoneE164) {
    return withCors(NextResponse.json({ ok: false, error: "Invalid phone" }, { status: 400 }), origin);
  }

  const campaign = await prisma.crmCampaign.upsert({
    where: { slug: body.campaignSlug },
    update: {},
    create: {
      slug: body.campaignSlug,
      name: body.campaignSlug,
      defaultSenderName: "Noah",
    },
  });

  let showingId = body.showingId;

  if (!showingId) {
    if (!body.showingStartsAt) {
      return withCors(
        NextResponse.json({ ok: false, error: "Missing showingId/showingStartsAt" }, { status: 400 }),
        origin
      );
    }

    const startsAt = new Date(body.showingStartsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return withCors(NextResponse.json({ ok: false, error: "Invalid showingStartsAt" }, { status: 400 }), origin);
    }

    const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);

    const showing = await prisma.crmShowing.create({
      data: {
        campaignId: campaign.id,
        startsAt,
        endsAt,
      },
    });

    showingId = showing.id;
  } else {
    const showing = await prisma.crmShowing.findUnique({ where: { id: showingId } });
    if (!showing || showing.campaignId !== campaign.id) {
      return withCors(NextResponse.json({ ok: false, error: "Invalid showing" }, { status: 400 }), origin);
    }
  }

  const contact = await prisma.crmContact.upsert({
    where: { phoneE164 },
    update: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || undefined,
    },
    create: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phoneE164,
      state: "UNKNOWN",
    },
  });

  const watchToken = generateWatchToken();
  const registration = await prisma.crmRegistration.create({
    data: {
      contactId: contact.id,
      campaignId: campaign.id,
      showingId,
      status: "REGISTERED",
      watchToken,
    },
  });

  const code = generate6DigitCode();
  const verification = await prisma.crmVerification.create({
    data: {
      purpose: "REGISTRATION",
      contactId: contact.id,
      registrationId: registration.id,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendAutomationSms(
    phoneE164,
    `Speedwell Law: your verification code is ${code}. It expires in 10 minutes. Reply STOP to opt out.`
  );

  return withCors(
    NextResponse.json({ ok: true, verificationId: verification.id, watchToken }),
    origin
  );
}
