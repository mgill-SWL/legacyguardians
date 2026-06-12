import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { bookAppointment } from "@/lib/booking/booking";
import { clientIpFrom, consumeRateLimit, phoneKey, publicEndpointRules } from "@/lib/rateLimit";
import { sendDiscoveryAppointmentNotification } from "@/lib/automation/discoveryNotifications";

export const dynamic = "force-dynamic";

type Body = {
  startsAtIso: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
};

function originAllowed(req: Request) {
  const allow = (process.env.BOOKING_ALLOWED_ORIGINS || "").trim();
  if (!allow) return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const allowed = allow
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

async function firmIdForPublicBooking() {
  const envFirmId = (process.env.BOOKING_FIRM_ID || "").trim();
  if (envFirmId) return envFirmId;
  const firm = await prisma.firm.findFirst({ select: { id: true } });
  if (!firm) throw new Error("No firm in database");
  return firm.id;
}

export async function POST(req: Request) {
  if (!originAllowed(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.startsAtIso) return NextResponse.json({ ok: false, error: "startsAtIso required" }, { status: 400 });

  const clientName = String(body.clientName || "").trim();
  if (!clientName) return NextResponse.json({ ok: false, error: "clientName required" }, { status: 400 });
  if (!String(body.clientEmail || "").trim() && !String(body.clientPhone || "").trim()) {
    return NextResponse.json({ ok: false, error: "clientEmail or clientPhone required" }, { status: 400 });
  }

  // Unauthenticated endpoint that creates records and sends SMS/calendar
  // invites — rate limit per contact, per IP, and globally.
  const phone = String(body.clientPhone || "").trim();
  const allowed = await consumeRateLimit(
    publicEndpointRules("public-book", {
      contactKey: phone ? phoneKey(phone) : String(body.clientEmail || "").trim().toLowerCase(),
      ip: clientIpFrom(req),
      globalPerHour: 30,
    })
  );
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many booking attempts. Please try again later or call the office." },
      { status: 429 }
    );
  }

  try {
    const booked = await bookAppointment({
      typeSlug: "discovery-call",
      startsAtIso: body.startsAtIso,
      clientName,
      clientEmail: body.clientEmail || null,
      clientPhone: body.clientPhone || null,
      attendeeEmails: body.clientEmail ? [body.clientEmail] : [],
    });

    // Schedule follow-ups/reminders.
    const firmId = await firmIdForPublicBooking();
    const type = await prisma.appointmentType.findUnique({ where: { slug: "discovery-call" } });
    if (!type) throw new Error("appointment type missing");
    const appt = await prisma.appointment.findUnique({ where: { id: booked.appointmentId } });
    if (!appt) throw new Error("appointment missing");

    const now = Date.now();
    const jobs = [
      { runAt: new Date(appt.startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_24H", apptId: booked.appointmentId } },
      { runAt: new Date(appt.startsAt.getTime() - 2 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_2H", apptId: booked.appointmentId } },
      { runAt: new Date(appt.startsAt.getTime() - 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_1H", apptId: booked.appointmentId } },
      { runAt: new Date(appt.startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_24H", apptId: booked.appointmentId } },
      { runAt: new Date(appt.startsAt.getTime() - 2 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_2M", apptId: booked.appointmentId } },
    ];
    const dueJobs = jobs.filter((j) => j.runAt.getTime() > now);

    if (dueJobs.length) {
      await prisma.scheduledJob.createMany({
        data: dueJobs.map((j) => ({ firmId, runAt: j.runAt, type: j.type, payload: j.payload as Prisma.InputJsonValue })),
      });
    }

    await Promise.allSettled([
      sendDiscoveryAppointmentNotification({ firmId, appointmentId: booked.appointmentId, kind: "BOOKED", channel: "SMS" }),
      sendDiscoveryAppointmentNotification({ firmId, appointmentId: booked.appointmentId, kind: "BOOKED", channel: "EMAIL" }),
    ]);

    return NextResponse.json({ ok: true, ...booked });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
