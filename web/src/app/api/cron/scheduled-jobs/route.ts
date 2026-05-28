import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendDiscoveryAppointmentNotification } from "@/lib/automation/discoveryNotifications";

export const dynamic = "force-dynamic";

const MAX_BATCH = 25;
const MAX_ATTEMPTS = 5;

function authOk(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

function isReminderKind(kind: unknown) {
  return String(kind || "").startsWith("REMINDER_");
}

function scheduledJobPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind = typeof record.kind === "string" ? record.kind : "";
  const apptId = typeof record.apptId === "string" ? record.apptId : "";
  if (!kind || !apptId) return null;
  return { kind, apptId };
}

export async function GET(req: Request) {
  if (!authOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();

  const pending = await prisma.scheduledJob.findMany({
    where: { status: "PENDING", runAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: [{ runAt: "asc" }],
    take: MAX_BATCH,
  });

  let processed = 0;
  let done = 0;
  let failed = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (const job of pending) {
    // Claim job
    const claim = await prisma.scheduledJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "IN_PROGRESS", attempts: { increment: 1 }, lastError: null },
    });
    if (claim.count !== 1) continue;

    processed += 1;
    try {
      const payload = scheduledJobPayload(job.payload);

      if (payload) {
        const appt = await prisma.appointment.findUnique({ where: { id: payload.apptId } });
        if (!appt) throw new Error("Appointment not found");

        if (appt.startsAt.getTime() <= now.getTime() || (isReminderKind(payload.kind) && job.runAt.getTime() <= job.createdAt.getTime())) {
          await prisma.scheduledJob.update({ where: { id: job.id }, data: { status: "DONE", lastError: null } });
          done += 1;
          continue;
        }

        if (job.type === "SEND_SMS") {
          await sendDiscoveryAppointmentNotification({ firmId: job.firmId, appointmentId: payload.apptId, kind: payload.kind, channel: "SMS" });
        } else if (job.type === "SEND_EMAIL") {
          await sendDiscoveryAppointmentNotification({ firmId: job.firmId, appointmentId: payload.apptId, kind: payload.kind, channel: "EMAIL" });
        } else {
          throw new Error(`Unknown job type: ${job.type}`);
        }

        await prisma.scheduledJob.update({ where: { id: job.id }, data: { status: "DONE", lastError: null } });
        done += 1;
        continue;
      }

      throw new Error("Unsupported job payload");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      errors.push({ id: job.id, error: msg });
      failed += 1;

      // If more attempts remain, re-queue; otherwise fail hard.
      const updated = await prisma.scheduledJob.update({
        where: { id: job.id },
        data: { status: job.attempts + 1 >= MAX_ATTEMPTS ? "FAILED" : "PENDING", lastError: msg },
        select: { status: true },
      });
      void updated;
    }
  }

  return NextResponse.json({ ok: true, processed, done, failed, errors });
}
