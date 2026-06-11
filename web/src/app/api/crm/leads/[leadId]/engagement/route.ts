import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ACTION_TO_FIELD = {
  proposal_prepared: "proposalPreparedAt",
  ra_prepared: "raPreparedAt",
  ra_sent: "raSentAt",
  ra_signed: "raSignedAt",
} as const;

type EngagementAction = keyof typeof ACTION_TO_FIELD;

function isEngagementAction(value: unknown): value is EngagementAction {
  return typeof value === "string" && value in ACTION_TO_FIELD;
}

export async function POST(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { leadId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (!isEngagementAction(action)) {
    return NextResponse.json({ ok: false, error: "invalid engagement action" }, { status: 400 });
  }

  const lead = await prisma.crmLeadPipeline.findUnique({
    where: { id: leadId },
    select: { id: true, convertedAt: true },
  });

  if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
  if (lead.convertedAt) return NextResponse.json({ ok: false, error: "lead already converted" }, { status: 409 });

  const field = ACTION_TO_FIELD[action];
  const updated = await prisma.crmLeadPipeline.update({
    where: { id: leadId },
    data: { [field]: new Date() },
    select: {
      id: true,
      proposalPreparedAt: true,
      raPreparedAt: true,
      raSentAt: true,
      raSignedAt: true,
    },
  });

  return NextResponse.json({ ok: true, lead: updated });
}
