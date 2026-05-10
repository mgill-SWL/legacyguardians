import { prisma } from "@/lib/prisma";
import { googleCreateEvent, googleFreeBusy } from "@/lib/google/google";

export type BookingSlot = { start: string; available: number; assignees: string[] };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function offsetMinutesAt(timeZone: string, d: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(d);
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

export async function getAppointmentTypeOrThrow(slug: string) {
  const type = await prisma.appointmentType.findUnique({
    where: { slug },
    include: { assignees: true },
  });
  if (!type) throw new Error(`Appointment type not found: ${slug}`);
  return type;
}

function inferTimeZone(type: { assignees: Array<{ timeZone: string }> }) {
  return type.assignees?.[0]?.timeZone || "America/New_York";
}

export async function getBookingSlots({
  typeSlug,
  date,
}: {
  typeSlug: string;
  date: string; // YYYY-MM-DD
}): Promise<{ date: string; tz: string; slots: BookingSlot[] }> {
  const type = await getAppointmentTypeOrThrow(typeSlug);
  const TZ = inferTimeZone(type);

  // Skip weekends in local TZ.
  const [yy, mm, dd] = date.split("-").map((x) => Number(x));
  const anchor = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(anchor);
  if (weekday === "Sat" || weekday === "Sun") return { date, tz: TZ, slots: [] };

  const dayStartUtc = utcFromLocal(date, 0, TZ);
  const dayEndUtc = utcFromLocal(date, 24 * 60, TZ);

  const enabled = type.assignees.filter((a) => a.enabled);
  if (!enabled.length) return { date, tz: TZ, slots: [] };

  const busyByAssignee = new Map<string, { start: number; end: number }[]>();
  await Promise.all(
    enabled.map(async (a) => {
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

  const minStartUtc = new Date(Date.now() + type.minNoticeHours * 60 * 60_000);
  const slots: BookingSlot[] = [];

  for (let min = 0; min < 24 * 60; min += type.startIntervalMin) {
    const startUtc = utcFromLocal(date, min, TZ);
    if (startUtc.getTime() < minStartUtc.getTime()) continue;
    const endUtc = new Date(startUtc.getTime() + type.durationMin * 60_000);

    const availableAssignees: string[] = [];
    for (const a of enabled) {
      if (min < a.weekdayStartMin || min + type.durationMin > a.weekdayEndMin) continue;
      if ((countBy.get(a.googleEmail) || 0) >= type.maxPerDay) continue;

      const busy = busyByAssignee.get(a.googleEmail) || [];
      const s = startUtc.getTime() - type.bufferBeforeMin * 60_000;
      const e = endUtc.getTime() + type.bufferAfterMin * 60_000;
      const isBusy = busy.some((b) => overlaps(s, e, b.start, b.end));
      if (!isBusy) availableAssignees.push(a.googleEmail);
    }

    if (availableAssignees.length) {
      slots.push({
        start: startUtc.toISOString(),
        available: availableAssignees.length,
        assignees: availableAssignees,
      });
    }
  }

  return { date, tz: TZ, slots };
}

export async function bookAppointment({
  typeSlug,
  startsAtIso,
  clientName,
  clientEmail,
  clientPhone,
}: {
  typeSlug: string;
  startsAtIso: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
}) {
  const type = await getAppointmentTypeOrThrow(typeSlug);
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) throw new Error("invalid startsAtIso");
  const endsAt = new Date(startsAt.getTime() + type.durationMin * 60_000);

  const candidates = type.assignees.filter((a) => a.enabled);
  if (!candidates.length) throw new Error("no assignees");

  const available: string[] = [];
  await Promise.all(
    candidates.map(async (a) => {
      const dayStart = new Date(startsAt);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

      const busy = await googleFreeBusy({
        googleEmail: a.googleEmail,
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
      });

      const s = startsAt.getTime() - type.bufferBeforeMin * 60_000;
      const e = endsAt.getTime() + type.bufferAfterMin * 60_000;
      const isBusy = busy.some((b) => overlaps(s, e, new Date(b.start).getTime(), new Date(b.end).getTime()));
      if (isBusy) return;

      const count = await prisma.appointment.count({
        where: {
          typeId: type.id,
          assignedGoogleEmail: a.googleEmail,
          startsAt: { gte: dayStart, lt: dayEnd },
          status: "SCHEDULED",
        },
      });
      if (count >= type.maxPerDay) return;

      available.push(a.googleEmail);
    })
  );

  if (!available.length) throw new Error("no availability");

  const dayStart = new Date(startsAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  let chosen = available[0];
  let best = Infinity;
  for (const email of available) {
    const c = await prisma.appointment.count({
      where: {
        typeId: type.id,
        assignedGoogleEmail: email,
        startsAt: { gte: dayStart, lt: dayEnd },
        status: "SCHEDULED",
      },
    });
    if (c < best) {
      best = c;
      chosen = email;
    }
  }

  const summary = `${type.name}${clientName ? ` — ${clientName}` : ""}`;
  const description = `Appointment type: ${type.slug}\n\nClient phone: ${clientPhone || ""}\nClient email: ${clientEmail || ""}`;

  const ev = await googleCreateEvent({
    googleEmail: chosen,
    summary,
    description,
    start: startsAt.toISOString(),
    end: endsAt.toISOString(),
    attendeeEmail: clientEmail || undefined,
  });

  const appt = await prisma.appointment.create({
    data: {
      typeId: type.id,
      startsAt,
      endsAt,
      assignedGoogleEmail: chosen,
      googleEventId: ev.id,
      clientName,
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
    },
    select: { id: true },
  });

  return { appointmentId: appt.id, assignedTo: chosen, eventId: ev.id };
}

