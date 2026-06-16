import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Matches the embed's evergreen default (web/src/app/embed/webinar-registration/page.tsx).
const EVERGREEN_ISO = "2030-01-01T00:00:00.000Z";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

type Body = {
  name?: string;
  slug?: string;
  evergreen?: boolean;
  startsAt?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const name = (body.name ?? "").trim();
  const slug = slugify(body.slug || body.name || "");

  if (!name) return NextResponse.json({ ok: false, error: "Webinar name is required." }, { status: 400 });
  if (!slug) return NextResponse.json({ ok: false, error: "A valid slug is required (letters, numbers, hyphens)." }, { status: 400 });

  let startsAt: Date;
  if (body.evergreen) {
    startsAt = new Date(EVERGREEN_ISO);
  } else {
    if (!body.startsAt) {
      return NextResponse.json(
        { ok: false, error: "Provide a date and time, or mark the webinar evergreen." },
        { status: 400 }
      );
    }
    startsAt = new Date(body.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid date/time." }, { status: 400 });
    }
  }
  const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000);

  // Create (or reuse) the campaign for this webinar, then ensure the showing
  // exists. Showing is keyed on the (campaignId, startsAt) unique constraint,
  // so re-submitting the same date is idempotent.
  const campaign = await prisma.crmCampaign.upsert({
    where: { slug },
    update: { name },
    create: { slug, name, defaultSenderName: "Noah" },
    select: { id: true, slug: true, name: true },
  });

  const showing = await prisma.crmShowing.upsert({
    where: { campaignId_startsAt: { campaignId: campaign.id, startsAt } },
    update: {},
    create: { campaignId: campaign.id, startsAt, endsAt },
    select: { id: true, startsAt: true },
  });

  return NextResponse.json({ ok: true, campaign, showing });
}
