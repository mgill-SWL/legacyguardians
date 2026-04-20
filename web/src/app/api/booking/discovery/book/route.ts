import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { googleCreateEvent, googleFreeBusy } from "@/lib/google/google";

export const dynamic = "force-dynamic";

const TZ = "America/New_York";

type Body = {
  startsAtIso: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.startsAtIso) return NextResponse.json({ ok: false, error: "startsAtIso required" }, { status: 400 });

  const startsAt = new Date(body.startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return NextResponse.json({ ok: false, error: "invalid startsAtIso" }, { status: 400 });

  const type = await prisma.appointmentType.findUnique({ where: { slug: "discovery-call" }, include: { assignees: true } });
  if (!type) return NextResponse.json({ ok: false, error: "appointment type missing" }, { status: 500 });

  const endsAt = new Date(startsAt.getTime() + type.durationMin * 60_000);

  // Find available assignees at this time.
  const candidates = type.assignees.filter((a) => a.enabled);
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

      // max/day
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

  if (!available.length) return NextResponse.json({ ok: false, error: "no availability" }, { status: 409 });

  // Round robin: pick the assignee with fewest appointments that day.
  const dayStart = new Date(startsAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  let chosen = available[0];
  let best = Infinity;
  for (const email of available) {
    const c = await prisma.appointment.count({
      where: { typeId: type.id, assignedGoogleEmail: email, startsAt: { gte: dayStart, lt: dayEnd }, status: "SCHEDULED" },
    });
    if (c < best) {
      best = c;
      chosen = email;
    }
  }

  const summary = `Speedwell Law Discovery Call${body.clientName ? ` — ${body.clientName}` : ""}`;
  const description = `Discovery call.\n\nClient phone: ${body.clientPhone || ""}\nClient email: ${body.clientEmail || ""}`;

  const ev = await googleCreateEvent({
    googleEmail: chosen,
    summary,
    description,
    start: startsAt.toISOString(),
    end: endsAt.toISOString(),
    attendeeEmail: body.clientEmail,
  });

  const appt = await prisma.appointment.create({
    data: {
      typeId: type.id,
      startsAt,
      endsAt,
      assignedGoogleEmail: chosen,
      googleEventId: ev.id,
      clientName: body.clientName,
      clientEmail: body.clientEmail,
      clientPhone: body.clientPhone,
    },
    select: { id: true },
  });

  // Schedule jobs (placeholders; actual senders wired next).
  const now = Date.now();
  const jobs = [
    { runAt: new Date(now + 60_000), type: "SEND_SMS" as const, payload: { kind: "BOOKED", apptId: appt.id } },
    { runAt: new Date(now + 60_000), type: "SEND_EMAIL" as const, payload: { kind: "BOOKED", apptId: appt.id } },
    { runAt: new Date(startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_24H", apptId: appt.id } },
    { runAt: new Date(startsAt.getTime() - 2 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_2H", apptId: appt.id } },
    { runAt: new Date(startsAt.getTime() - 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_1H", apptId: appt.id } },
    { runAt: new Date(startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_24H", apptId: appt.id } },
    { runAt: new Date(startsAt.getTime() - 2 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_2M", apptId: appt.id } },
  ];

  await prisma.scheduledJob.createMany({
    data: jobs.map((j) => ({
      runAt: j.runAt,
      type: j.type,
      payload: j.payload as any,
    })),
  });

  return NextResponse.json({ ok: true, appointmentId: appt.id, assignedTo: chosen, eventId: ev.id, tz: TZ });
}
