import { getServerSession } from "next-auth";
import type { CrmAppointmentStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const APPT_STATUSES = new Set<string>(["SCHEDULED", "SHOWED", "NO_SHOW", "CANCELED", "RESCHEDULED"]);

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseStatus(value: unknown): CrmAppointmentStatus | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return APPT_STATUSES.has(String(value)) ? (String(value) as CrmAppointmentStatus) : undefined;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { leadId } = await ctx.params;
  const lead = await prisma.crmLeadPipeline.findFirst({
    where: { id: leadId, contact: { OR: [{ firmId: user.activeFirmId }, { firmId: null }] } },
    select: { id: true, intakeCallAttemptedAt: true },
  });
  if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Prisma.CrmLeadPipelineUpdateInput = {};

  if (body.intakeCallAttempted !== undefined) {
    const attempted = Boolean(body.intakeCallAttempted);
    data.intakeCallAttempted = attempted;
    // Stamp the first time it's marked attempted; clear if unset.
    if (attempted && !lead.intakeCallAttemptedAt) data.intakeCallAttemptedAt = new Date();
    if (!attempted) data.intakeCallAttemptedAt = null;
  }

  for (const [key, at, status] of [
    ["appt1", "appt1At", "appt1Status"],
    ["appt2", "appt2At", "appt2Status"],
  ] as const) {
    const dateVal = parseDate(body[at]);
    if (dateVal !== undefined) (data as Record<string, unknown>)[at] = dateVal;
    const statusVal = parseStatus(body[status]);
    if (body[status] !== undefined && statusVal === undefined) {
      return NextResponse.json({ ok: false, error: `invalid ${key} status` }, { status: 400 });
    }
    if (statusVal !== undefined) (data as Record<string, unknown>)[status] = statusVal;
    // Mark the appointment as scheduled by default when a date is set with no status.
    if (dateVal && body[status] === undefined) (data as Record<string, unknown>)[status] = "SCHEDULED";
  }

  if (body.leadQualityScore !== undefined) {
    if (body.leadQualityScore === null || body.leadQualityScore === "") {
      data.leadQualityScore = null;
    } else {
      const n = Number(body.leadQualityScore);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        return NextResponse.json({ ok: false, error: "quality score must be an integer 0–100" }, { status: 400 });
      }
      data.leadQualityScore = n;
    }
  }

  if (body.additionalNotes !== undefined) {
    data.additionalNotes = String(body.additionalNotes || "").trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "no fields to update" }, { status: 400 });
  }

  const updated = await prisma.crmLeadPipeline.update({
    where: { id: lead.id },
    data,
    select: {
      id: true,
      intakeCallAttempted: true,
      appt1At: true,
      appt1Status: true,
      appt2At: true,
      appt2Status: true,
      leadQualityScore: true,
      additionalNotes: true,
    },
  });

  return NextResponse.json({ ok: true, lead: updated });
}
