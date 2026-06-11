import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CONFLICT_STATUSES = new Set(["NOT_STARTED", "REVIEW_REQUIRED", "CLEARED", "CONFLICT_IDENTIFIED", "WAIVED"]);
const DUPLICATE_STATUSES = new Set(["NONE", "POSSIBLE_DUPLICATE", "DUPLICATE_CONFIRMED", "NOT_DUPLICATE"]);

export async function PATCH(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { leadId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    conflictCheckNotes?: unknown;
    conflictCheckStatus?: unknown;
    duplicateReviewNotes?: unknown;
    duplicateReviewStatus?: unknown;
  };

  const lead = await prisma.crmLeadPipeline.findFirst({
    where: {
      id: leadId,
      contact: { OR: [{ firmId: user.activeFirmId }, { firmId: null }] },
    },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });

  const data: {
    conflictCheckNotes?: string | null;
    conflictCheckStatus?: "NOT_STARTED" | "REVIEW_REQUIRED" | "CLEARED" | "CONFLICT_IDENTIFIED" | "WAIVED";
    conflictCheckUpdatedAt?: Date;
    duplicateReviewNotes?: string | null;
    duplicateReviewStatus?: "NONE" | "POSSIBLE_DUPLICATE" | "DUPLICATE_CONFIRMED" | "NOT_DUPLICATE";
  } = {};

  if (body.conflictCheckStatus !== undefined) {
    if (typeof body.conflictCheckStatus !== "string" || !CONFLICT_STATUSES.has(body.conflictCheckStatus)) {
      return NextResponse.json({ ok: false, error: "invalid conflict status" }, { status: 400 });
    }
    data.conflictCheckStatus = body.conflictCheckStatus as typeof data.conflictCheckStatus;
    data.conflictCheckUpdatedAt = new Date();
  }

  if (body.duplicateReviewStatus !== undefined) {
    if (typeof body.duplicateReviewStatus !== "string" || !DUPLICATE_STATUSES.has(body.duplicateReviewStatus)) {
      return NextResponse.json({ ok: false, error: "invalid duplicate status" }, { status: 400 });
    }
    data.duplicateReviewStatus = body.duplicateReviewStatus as typeof data.duplicateReviewStatus;
  }

  if (body.conflictCheckNotes !== undefined) {
    data.conflictCheckNotes = String(body.conflictCheckNotes || "").trim() || null;
  }

  if (body.duplicateReviewNotes !== undefined) {
    data.duplicateReviewNotes = String(body.duplicateReviewNotes || "").trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "no review fields supplied" }, { status: 400 });
  }

  const updated = await prisma.crmLeadPipeline.update({
    where: { id: lead.id },
    data,
    select: {
      conflictCheckNotes: true,
      conflictCheckStatus: true,
      conflictCheckUpdatedAt: true,
      duplicateReviewNotes: true,
      duplicateReviewStatus: true,
      id: true,
    },
  });

  return NextResponse.json({ ok: true, lead: updated });
}
