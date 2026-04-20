import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { googleFreeBusy } from "@/lib/google/google";

export const dynamic = "force-dynamic";

const TZ = "America/New_York";

function offsetMinutesAt(timeZone: string, d: Date) {
  // Node supports shortOffset in modern runtimes; fallback to 0.
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(d);
    const tz = parts.find((p) => p.type === "timeZoneName")?.value || ""; // e.g. GMT-4
    const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return 0;
    const sign = m[1] === "-" ? -1 : 1;
    const hh = Number(m[2] || 0);
    const mm = Number(m[3] || 0);
    return sign * (hh * 60 + mm);
  } catch {
    return 0;
  }
}

function utcFromLocal(dateStr: string, minutesSinceMidnight: number, timeZone: string) {
  const [y, m, d] = dateStr.split("-").map((x) => Number(x));
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)); // midday to get correct DST offset
  const offsetMin = offsetMinutesAt(timeZone, anchor);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return new Date(utcMidnight.getTime() - offsetMin * 60_000 + minutesSinceMidnight * 60_000);
}

async function ensureDiscoveryType() {
  const type = await prisma.appointmentType.upsert({
    where: { slug: "discovery-call" },
    create: {
      slug: "discovery-call",
      name: "Discovery Call",
      durationMin: 15,
      startIntervalMin: 15,
      bufferBeforeMin: 15,
      bufferAfterMin: 0,
      minNoticeHours: 24,
      rollingWeeks: 8,
      maxPerDay: 6,
      assignees: {
        create: [
          {
            googleEmail: "jgreen@speedwelllaw.com",
            displayName: "Jessica Green",
            timeZone: TZ,
            weekdayStartMin: 9 * 60,
            weekdayEndMin: 17 * 60,
          },
          {
            googleEmail: "welcome@speedwelllaw.com",
            displayName: "Christopher Heredia",
            timeZone: TZ,
            weekdayStartMin: 11 * 60,
            weekdayEndMin: 19 * 60,
          },
        ],
      },
    },
    update: {
      durationMin: 15,
      startIntervalMin: 15,
      bufferBeforeMin: 15,
      bufferAfterMin: 0,
      minNoticeHours: 24,
      rollingWeeks: 8,
      maxPerDay: 6,
    },
    include: { assignees: true },
  });

  return type;
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ ok: false, error: "date required (YYYY-MM-DD)" }, { status: 400 });

  const type = await ensureDiscoveryType();

  // Compute slot candidates across assignees.
  const dayStartUtc = utcFromLocal(date, 0, TZ);
  const dayEndUtc = utcFromLocal(date, 24 * 60, TZ);

  // Fetch busy windows per assignee in parallel.
  const busyByAssignee = new Map<string, { start: number; end: number }[]>();
  await Promise.all(
    type.assignees.filter((a) => a.enabled).map(async (a) => {
      const busy = await googleFreeBusy({
        googleEmail: a.googleEmail,
        timeMin: dayStartUtc.toISOString(),
        timeMax: dayEndUtc.toISOString(),
      });
      busyByAssignee.set(
        a.googleEmail,
        busy.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }))
      );
    })
  );

  // Count existing appointments per assignee for that day.
  const appts = await prisma.appointment.findMany({
    where: {
      typeId: type.id,
      startsAt: { gte: dayStartUtc, lt: dayEndUtc },
      status: "SCHEDULED",
    },
    select: { assignedGoogleEmail: true },
  });
  const countBy = new Map<string, number>();
  for (const a of appts) countBy.set(a.assignedGoogleEmail, (countBy.get(a.assignedGoogleEmail) || 0) + 1);

  const slots: { start: string; available: number; assignees: string[] }[] = [];

  // Candidate slots every 15 minutes. We assume weekdays only (Mon–Fri).
  for (let min = 0; min < 24 * 60; min += type.startIntervalMin) {
    const startUtc = utcFromLocal(date, min, TZ);
    const endUtc = new Date(startUtc.getTime() + type.durationMin * 60_000);

    const availableAssignees: string[] = [];
    for (const a of type.assignees) {
      if (!a.enabled) continue;
      // weekday hours
      if (min < a.weekdayStartMin || min + type.durationMin > a.weekdayEndMin) continue;
      if ((countBy.get(a.googleEmail) || 0) >= type.maxPerDay) continue;

      const busy = busyByAssignee.get(a.googleEmail) || [];
      const s = startUtc.getTime() - type.bufferBeforeMin * 60_000;
      const e = endUtc.getTime() + type.bufferAfterMin * 60_000;
      const isBusy = busy.some((b) => overlaps(s, e, b.start, b.end));
      if (!isBusy) availableAssignees.push(a.googleEmail);
    }

    if (availableAssignees.length) {
      slots.push({ start: startUtc.toISOString(), available: availableAssignees.length, assignees: availableAssignees });
    }
  }

  return NextResponse.json({ ok: true, date, slots });
}
