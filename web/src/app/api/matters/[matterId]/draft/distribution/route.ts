import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import type { IntakeV1 } from "@/lib/intakeTypes";
import { draftDistribution } from "@/lib/drafting/distribution";

export const dynamic = "force-dynamic";

// POST /api/matters/[matterId]/draft/distribution
// Returns an AI-drafted bespoke distribution clause for attorney review.
// Does NOT persist anything — the attorney reviews/edits, then saves via the
// existing PATCH /api/matters/[matterId]/intake route.
export async function POST(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) {
    return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });
  }

  const { matterId } = await ctx.params;
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { firmId: true, intake: { select: { data: true } } },
  });
  if (!matter) return NextResponse.json({ ok: false, error: "matter not found" }, { status: 404 });
  if (matter.firmId && matter.firmId !== user.activeFirmId) {
    return NextResponse.json({ ok: false, error: "matter not in active firm" }, { status: 403 });
  }

  const intake = matter.intake?.data as IntakeV1 | undefined;
  if (!intake || typeof intake !== "object") {
    return NextResponse.json(
      { ok: false, error: "This matter has no intake yet. Complete intake first." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => null)) as { instructions?: string } | null;

  const result = await draftDistribution(intake, body?.instructions);
  if (!result.ok) {
    // Key-not-set is an expected, recoverable condition — surface it without a 5xx.
    if (result.needsKey) {
      return NextResponse.json({ ok: false, needsKey: true, error: result.error });
    }
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    clause: result.draft.clause,
    notes: result.draft.notes,
    model: result.model,
  });
}
