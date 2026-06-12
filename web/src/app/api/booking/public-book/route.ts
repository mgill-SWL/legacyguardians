import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { bookAppointment } from "@/lib/booking/booking";
import { prisma } from "@/lib/prisma";
import { clientIpFrom, consumeRateLimit, phoneKey, publicEndpointRules } from "@/lib/rateLimit";
import { sendDiscoveryAppointmentNotification } from "@/lib/automation/discoveryNotifications";

export const dynamic = "force-dynamic";

type JsonObject = Record<string, Prisma.InputJsonValue>;

type Body = {
  type: string;
  startsAtIso: string;
  firstName?: string;
  lastName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  needHelpWith?: string;
  heardAboutUs?: string;
  smsConsent?: boolean;
  smsConsentText?: string;
  additionalAttendeeEmails?: string[];
  location?: string;
  timeZone?: string;
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

function isDiscoveryCall(type: string) {
  return type.trim() === "discovery-call";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidPhone(value: string) {
  return value.replace(/\D/g, "").length >= 10;
}

async function firmIdForPublicBooking() {
  const envFirmId = (process.env.BOOKING_FIRM_ID || "").trim();
  if (envFirmId) return envFirmId;
  const firm = await prisma.firm.findFirst({ select: { id: true } });
  if (!firm) throw new Error("No firm in database");
  return firm.id;
}

async function publicBookingCreator(firmId: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ activeFirmId: firmId }, { firmMemberships: { some: { firmId } } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, activeLocationId: true, defaultLocationId: true },
  });
  if (!user) throw new Error("No firm user available to own public booking matters");
  return user;
}

async function createDiscoveryMatter({
  firmId,
  body,
  booked,
}: {
  firmId: string;
  body: Required<Pick<Body, "startsAtIso">> & Body;
  booked: { appointmentId: string; assignedTo: string; eventId: string };
}) {
  const creator = await publicBookingCreator(firmId);
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const clientName = String(body.clientName || `${firstName} ${lastName}`).trim();
  const clientEmail = String(body.clientEmail || "").trim();
  const clientPhone = String(body.clientPhone || "").trim();
  const consentedAt = new Date();

  const appt = await prisma.appointment.findUnique({ where: { id: booked.appointmentId } });
  if (!appt) throw new Error("appointment missing");

  const defaultLocationId = creator.defaultLocationId || creator.activeLocationId || null;
  const validLocation = defaultLocationId
    ? await prisma.firmLocation.findFirst({ where: { id: defaultLocationId, firmId }, select: { id: true } })
    : null;

  const intakeData = {
    source: "website_discovery_widget",
    version: 1,
    submittedAt: consentedAt.toISOString(),
    contact: {
      firstName,
      lastName,
      fullName: clientName,
      email: clientEmail,
      phone: clientPhone,
    },
    lead: {
      needHelpWith: String(body.needHelpWith || "").trim(),
      heardAboutUs: String(body.heardAboutUs || "").trim(),
    },
    consent: {
      smsConsent: Boolean(body.smsConsent),
      smsConsentAt: consentedAt.toISOString(),
      smsConsentText: String(body.smsConsentText || "").trim(),
    },
    discoveryCall: {
      appointmentId: booked.appointmentId,
      googleEventId: booked.eventId,
      startsAt: appt.startsAt.toISOString(),
      endsAt: appt.endsAt.toISOString(),
      assignedGoogleEmail: booked.assignedTo,
      location: String(body.location || "Phone").trim() || "Phone",
      timeZone: String(body.timeZone || "America/New_York").trim(),
      additionalAttendeeEmails: Array.isArray(body.additionalAttendeeEmails) ? body.additionalAttendeeEmails : [],
    },
    rawSubmission: body,
  };

  const matter = await prisma.matter.create({
    data: {
      firmId,
      createdById: creator.id,
      displayName: `${clientName} — Discovery Call`,
      status: "INTAKE_IN_PROGRESS",
      primaryEmail: clientEmail || null,
      primaryPhone: clientPhone || null,
      primaryLocationId: validLocation?.id || null,
      intake: { create: { data: intakeData as JsonObject } },
      timelineEvents: {
        create: {
          firmId,
          eventType: "MANUAL_INTERNAL_NOTE",
          title: "Website Discovery Call booked",
          body: `${clientName} booked a discovery call for ${appt.startsAt.toISOString()}. Need help with: ${intakeData.lead.needHelpWith || "not provided"}. Heard about us: ${intakeData.lead.heardAboutUs || "not provided"}.`,
          details: intakeData as JsonObject,
          occurredAt: consentedAt,
        },
      },
    },
    select: { id: true },
  });

  return matter.id;
}

export async function POST(req: Request) {
  if (!originAllowed(req)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const type = body?.type?.trim() || "";
  if (!type) return NextResponse.json({ ok: false, error: "type required" }, { status: 400 });
  if (!body?.startsAtIso) return NextResponse.json({ ok: false, error: "startsAtIso required" }, { status: 400 });

  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const clientName = String(body.clientName || `${firstName} ${lastName}`).trim();
  const clientEmail = String(body.clientEmail || "").trim();
  const clientPhone = String(body.clientPhone || "").trim();

  if (!clientName) return NextResponse.json({ ok: false, error: "clientName required" }, { status: 400 });
  if (isDiscoveryCall(type)) {
    if (!firstName) return NextResponse.json({ ok: false, error: "firstName required" }, { status: 400 });
    if (!lastName) return NextResponse.json({ ok: false, error: "lastName required" }, { status: 400 });
    if (!clientEmail || !isValidEmail(clientEmail)) return NextResponse.json({ ok: false, error: "valid clientEmail required" }, { status: 400 });
    if (!clientPhone || !isValidPhone(clientPhone)) return NextResponse.json({ ok: false, error: "valid clientPhone required" }, { status: 400 });
    if (!String(body.needHelpWith || "").trim()) return NextResponse.json({ ok: false, error: "needHelpWith required" }, { status: 400 });
    if (!String(body.heardAboutUs || "").trim()) return NextResponse.json({ ok: false, error: "heardAboutUs required" }, { status: 400 });
    if (!body.smsConsent) return NextResponse.json({ ok: false, error: "smsConsent required" }, { status: 400 });
  } else if (!clientEmail && !clientPhone) {
    return NextResponse.json({ ok: false, error: "clientEmail or clientPhone required" }, { status: 400 });
  }

  // Unauthenticated endpoint that creates records and sends SMS/calendar
  // invites — rate limit per contact, per IP, and globally.
  const allowed = await consumeRateLimit(
    publicEndpointRules("public-book", {
      contactKey: clientPhone ? phoneKey(clientPhone) : clientEmail.toLowerCase(),
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
      typeSlug: type,
      startsAtIso: body.startsAtIso,
      clientName,
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
      attendeeEmails: Array.isArray(body.additionalAttendeeEmails) ? body.additionalAttendeeEmails : [],
    });

    // Schedule follow-ups/reminders (v1: only discovery-call has templates today).
    const firmId = await firmIdForPublicBooking();
    const appt = await prisma.appointment.findUnique({ where: { id: booked.appointmentId } });
    if (!appt) throw new Error("appointment missing");

    let matterId: string | undefined;
    if (isDiscoveryCall(type)) {
      matterId = await createDiscoveryMatter({ firmId, body, booked });

      const now = Date.now();
      const jobs = [
        { runAt: new Date(appt.startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_24H", apptId: booked.appointmentId, matterId } },
        { runAt: new Date(appt.startsAt.getTime() - 2 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_2H", apptId: booked.appointmentId, matterId } },
        { runAt: new Date(appt.startsAt.getTime() - 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_1H", apptId: booked.appointmentId, matterId } },
        { runAt: new Date(appt.startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_24H", apptId: booked.appointmentId, matterId } },
        { runAt: new Date(appt.startsAt.getTime() - 2 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_2M", apptId: booked.appointmentId, matterId } },
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
    }

    return NextResponse.json({ ok: true, ...booked, matterId });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
