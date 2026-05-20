import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

type PricingMode = "HOURLY" | "FLAT";

type Payload = {
  matterId?: string;
  workDate?: string; // YYYY-MM-DD
  narrative?: string;
  pricingMode?: PricingMode;

  locationId?: string;

  // HOURLY
  durationTenths?: string; // e.g. "3" => 0.3h
  hourlyRateUsd?: string; // optional

  // FLAT
  flatAmountUsd?: string; // e.g. "2800"

  timekeeperUserId?: string;
  billable?: boolean;
};

function parseMoneyCents(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function parseTenths(raw: string) {
  const cleaned = raw.trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  // allow decimals like 1.5 tenths? (rare) — keep but round to nearest tenth
  return Math.round(n * 10) / 10;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ error: "Signed-in user has no active firm" }, { status: 400 });

  const json = (await request.json().catch(() => null)) as Payload | null;
  const matterId = json?.matterId;
  const workDate = json?.workDate;
  const narrative = (json?.narrative || "").trim();
  const pricingMode = json?.pricingMode || "HOURLY";
  const billable = json?.billable ?? true;
  const requestedLocationId = json?.locationId;

  const timekeeperUserId = json?.timekeeperUserId || user.id;

  if (!matterId || !workDate || !narrative) {
    return NextResponse.json({ error: "matterId, workDate, narrative are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return NextResponse.json({ error: "workDate must be YYYY-MM-DD" }, { status: 400 });
  }
  if (pricingMode !== "HOURLY" && pricingMode !== "FLAT") {
    return NextResponse.json({ error: "Invalid pricingMode" }, { status: 400 });
  }

  // v1: matters may have null firmId in older data; treat the user's active firm as authoritative and backfill.
  const matter = await prisma.matter.findFirst({ where: { id: matterId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  if (matter.firmId && matter.firmId !== user.activeFirmId) {
    return NextResponse.json({ error: "Matter is not in your active firm" }, { status: 403 });
  }

  if (!matter.firmId) {
    await prisma.matter.update({ where: { id: matter.id }, data: { firmId: user.activeFirmId } });
  }

  // Determine location for the entry: explicit locationId > matter.primaryLocationId > user's default/active location.
  const resolvedMatter = matter.firmId ? matter : await prisma.matter.findFirst({ where: { id: matter.id } });

  const candidateLocationId =
    requestedLocationId ||
    (resolvedMatter as any)?.primaryLocationId ||
    user.defaultLocationId ||
    user.activeLocationId ||
    null;

  let locationId: string | null = null;
  if (candidateLocationId) {
    const loc = await prisma.firmLocation.findFirst({ where: { id: candidateLocationId, firmId: user.activeFirmId } });
    if (!loc) return NextResponse.json({ error: "Invalid locationId for your active firm" }, { status: 400 });
    locationId = loc.id;
  }

  const timekeeper = await prisma.user.findFirst({ where: { id: timekeeperUserId } });
  if (!timekeeper) return NextResponse.json({ error: "Timekeeper not found" }, { status: 404 });

  let durationMinutes = 0;
  let hourlyRateCents: number | null = null;
  let flatAmountCents: number | null = null;

  if (pricingMode === "HOURLY") {
    const tenths = parseTenths(json?.durationTenths || "");
    if (tenths === null) return NextResponse.json({ error: "durationTenths is required for HOURLY entries" }, { status: 400 });
    durationMinutes = Math.round(tenths * 6);

    if (durationMinutes <= 0) {
      return NextResponse.json({ error: "durationTenths must be > 0 for HOURLY entries" }, { status: 400 });
    }

    if (json?.hourlyRateUsd) {
      const cents = parseMoneyCents(json.hourlyRateUsd);
      if (cents === null) return NextResponse.json({ error: "Invalid hourlyRateUsd" }, { status: 400 });
      hourlyRateCents = cents;
    }
  } else {
    const cents = parseMoneyCents(json?.flatAmountUsd || "");
    if (cents === null || cents <= 0) {
      return NextResponse.json({ error: "flatAmountUsd is required for FLAT entries" }, { status: 400 });
    }
    flatAmountCents = cents;
    durationMinutes = 0;
  }

  const entry = await prisma.timeEntry.create({
    data: {
      firmId: user.activeFirmId,
      matterId: matter.id,
      locationId,
      timekeeperId: timekeeper.id,
      createdByUserId: user.id,
      workDate: new Date(`${workDate}T00:00:00.000Z`),
      narrative,
      pricingMode,
      durationMinutes,
      hourlyRateCents,
      flatAmountCents,
      billable,
      status: "DRAFT",
    },
    select: { id: true },
  });

  await prisma.matterTimelineEvent.create({
    data: {
      firmId: user.activeFirmId,
      matterId: matter.id,
      actorUserId: user.id,
      eventType: "TIME_ENTRY_CREATED",
      title: "Draft timecard created",
      body: narrative,
      relatedTimeEntryId: entry.id,
      details: {
        pricingMode,
        durationMinutes,
        hourlyRateCents,
        flatAmountCents,
        billable,
        timekeeperUserId: timekeeper.id,
      },
    },
  });

  return NextResponse.json({ ok: true, id: entry.id });
}
