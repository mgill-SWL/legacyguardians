import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { findIntakeMatches, getOrCreateIntakeCampaign, reviewFlagsFromMatch } from "@/lib/crm/intakeMatching";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ResolveAction = "attach_lead" | "create_lead" | "not_lead";

function isResolveAction(value: unknown): value is ResolveAction {
  return value === "attach_lead" || value === "create_lead" || value === "not_lead";
}

function latestInboundBody(thread: {
  messages: Array<{ body: string; direction: string; createdAt: Date }>;
}) {
  return thread.messages.find((message) => message.direction === "INBOUND")?.body || thread.messages[0]?.body || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { threadId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; leadId?: unknown };
  if (!isResolveAction(body.action)) {
    return NextResponse.json({ ok: false, error: "invalid resolve action" }, { status: 400 });
  }

  const thread = await prisma.crmMessageThread.findUnique({
    where: { id: threadId },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!thread) return NextResponse.json({ ok: false, error: "thread not found" }, { status: 404 });

  if (body.action === "not_lead") {
    const updated = await prisma.crmMessageThread.update({
      where: { id: thread.id },
      data: {
        intakeResolutionStatus: "RESOLVED",
        leadId: null,
        matchSummary: "Marked not a lead by intake review.",
        needsConflictCheck: false,
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, threadId: updated.id });
  }

  if (body.action === "attach_lead") {
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    if (!leadId) return NextResponse.json({ ok: false, error: "leadId required" }, { status: 400 });

    const lead = await prisma.crmLeadPipeline.findFirst({
      where: {
        id: leadId,
        contact: { OR: [{ firmId: user.activeFirmId }, { firmId: null }] },
      },
      select: { id: true },
    });
    if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });

    await prisma.crmMessageThread.update({
      where: { id: thread.id },
      data: {
        intakeResolutionStatus: "RESOLVED",
        leadId: lead.id,
        matchConfidence: "HIGH",
        matchSummary: "Attached to an existing lead by intake review.",
        needsConflictCheck: true,
      },
    });

    await prisma.crmLeadPipeline.update({
      where: { id: lead.id },
      data: { conflictCheckStatus: "REVIEW_REQUIRED" },
    });

    return NextResponse.json({ ok: true, leadId: lead.id, threadId: thread.id });
  }

  const match = await findIntakeMatches({
    email: thread.contact.email,
    firmId: user.activeFirmId,
    firstName: thread.contact.firstName,
    lastName: thread.contact.lastName,
    phoneE164: thread.contact.phoneE164,
  });

  if (match.exactOpenLead) {
    await prisma.crmMessageThread.update({
      where: { id: thread.id },
      data: {
        intakeResolutionStatus: "RESOLVED",
        leadId: match.exactOpenLead.id,
        matchConfidence: "HIGH",
        matchSummary: "Exact phone/email matched an open lead during intake review.",
        needsConflictCheck: true,
      },
    });
    return NextResponse.json({ ok: true, existing: true, leadId: match.exactOpenLead.id, threadId: thread.id });
  }

  const campaign = await getOrCreateIntakeCampaign("INBOUND_TEXT");
  const notes = latestInboundBody(thread);
  const lead = await prisma.crmLeadPipeline.upsert({
    where: { contactId_campaignId: { contactId: thread.contactId, campaignId: campaign.id } },
    create: {
      additionalNotes: notes,
      campaignId: campaign.id,
      conflictCheckStatus: "REVIEW_REQUIRED",
      contactId: thread.contactId,
      sourceType: "INBOUND_TEXT",
      ...reviewFlagsFromMatch(match),
    },
    update: {
      additionalNotes: notes || undefined,
      conflictCheckStatus: "REVIEW_REQUIRED",
      sourceType: "INBOUND_TEXT",
      ...reviewFlagsFromMatch(match),
    },
    select: { id: true },
  });

  await prisma.crmMessageThread.update({
    where: { id: thread.id },
    data: {
      intakeResolutionStatus: "RESOLVED",
      leadId: lead.id,
      matchConfidence: match.possibleDuplicateCount ? "MEDIUM" : "HIGH",
      matchSummary: match.possibleDuplicateCount
        ? "Lead created from thread with possible duplicate review still required."
        : "Lead created from thread by intake review.",
      needsConflictCheck: true,
    },
  });

  return NextResponse.json({ ok: true, leadId: lead.id, threadId: thread.id });
}
