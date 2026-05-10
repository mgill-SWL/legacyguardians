import { NextResponse } from "next/server";

import { bookAppointment } from "@/lib/booking/booking";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  type: string;
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
  if (!body?.type?.trim()) return NextResponse.json({ ok: false, error: "type required" }, { status: 400 });
  if (!body?.startsAtIso) return NextResponse.json({ ok: false, error: "startsAtIso required" }, { status: 400 });

  const clientName = String(body.clientName || "").trim();
  if (!clientName) return NextResponse.json({ ok: false, error: "clientName required" }, { status: 400 });
  if (!String(body.clientEmail || "").trim() && !String(body.clientPhone || "").trim()) {
    return NextResponse.json({ ok: false, error: "clientEmail or clientPhone required" }, { status: 400 });
  }

  try {
    const booked = await bookAppointment({
      typeSlug: body.type.trim(),
      startsAtIso: body.startsAtIso,
      clientName,
      clientEmail: body.clientEmail || null,
      clientPhone: body.clientPhone || null,
    });

    // Schedule follow-ups/reminders (v1: only discovery-call has templates today).
    const firmId = await firmIdForPublicBooking();
    const appt = await prisma.appointment.findUnique({ where: { id: booked.appointmentId } });
    if (!appt) throw new Error("appointment missing");

    if (body.type.trim() === "discovery-call") {
      const now = Date.now();
      const jobs = [
        { runAt: new Date(now + 60_000), type: "SEND_SMS" as const, payload: { kind: "BOOKED", apptId: booked.appointmentId } },
        { runAt: new Date(now + 60_000), type: "SEND_EMAIL" as const, payload: { kind: "BOOKED", apptId: booked.appointmentId } },
        { runAt: new Date(appt.startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_24H", apptId: booked.appointmentId } },
        { runAt: new Date(appt.startsAt.getTime() - 2 * 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_2H", apptId: booked.appointmentId } },
        { runAt: new Date(appt.startsAt.getTime() - 60 * 60_000), type: "SEND_EMAIL" as const, payload: { kind: "REMINDER_1H", apptId: booked.appointmentId } },
        { runAt: new Date(appt.startsAt.getTime() - 24 * 60 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_24H", apptId: booked.appointmentId } },
        { runAt: new Date(appt.startsAt.getTime() - 2 * 60_000), type: "SEND_SMS" as const, payload: { kind: "REMINDER_2M", apptId: booked.appointmentId } },
      ];

      await prisma.scheduledJob.createMany({
        data: jobs.map((j) => ({ firmId, runAt: j.runAt, type: j.type, payload: j.payload as any })),
      });
    }

    return NextResponse.json({ ok: true, ...booked });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}

