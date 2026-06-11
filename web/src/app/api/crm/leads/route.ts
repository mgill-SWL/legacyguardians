import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { findIntakeMatches, reviewFlagsFromMatch } from "@/lib/crm/intakeMatching";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LeadCreateBody = {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string;
  campaignSlug?: string;
  campaignName?: string;
  additionalNotes?: string | null;
};

function cleanPhone(input: string) {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as LeadCreateBody | null;
  const firstName = String(body?.firstName || "").trim();
  const lastName = String(body?.lastName || "").trim();
  const email = String(body?.email || "").trim().toLowerCase() || null;
  const phoneE164 = cleanPhone(String(body?.phone || ""));
  const additionalNotes = String(body?.additionalNotes || "").trim() || null;

  if (!firstName && !lastName) {
    return NextResponse.json({ ok: false, error: "lead name is required" }, { status: 400 });
  }
  if (!phoneE164 || phoneE164.length < 8) {
    return NextResponse.json({ ok: false, error: "phone number is required" }, { status: 400 });
  }

  const campaignNameInput = String(body?.campaignName || "").trim();
  const campaignSlug = slugify(String(body?.campaignSlug || "").trim() || campaignNameInput || "Manual lead") || "manual-lead";
  const campaignName = campaignNameInput || campaignSlug.replace(/-/g, " ");

  const existingCampaign = await prisma.crmCampaign.findUnique({
    where: { slug: campaignSlug },
    select: { id: true },
  });
  const campaign =
    existingCampaign ||
    (await prisma.crmCampaign.create({
      data: {
        slug: campaignSlug,
        name: campaignName,
        defaultSenderName: session.user.name || "Staff",
      },
      select: { id: true },
    }));

  const match = await findIntakeMatches({
    email,
    firmId: user.activeFirmId,
    firstName,
    lastName,
    phoneE164,
  });

  if (match.exactOpenLead) {
    return NextResponse.json({
      ok: true,
      leadId: match.exactOpenLead.id,
      existing: true,
      match: "exact_open_lead",
    });
  }

  const contact = await prisma.crmContact.upsert({
    where: { phoneE164 },
    create: {
      firmId: user.activeFirmId,
      firstName,
      lastName,
      email,
      phoneE164,
    },
    update: {
      firmId: user.activeFirmId,
      firstName,
      lastName,
      email,
    },
    select: { id: true },
  });

  const existing = await prisma.crmLeadPipeline.findUnique({
    where: { contactId_campaignId: { contactId: contact.id, campaignId: campaign.id } },
    select: { id: true },
  });
  if (existing) {
    const updated = await prisma.crmLeadPipeline.update({
      where: { id: existing.id },
      data: {
        additionalNotes,
        dateAdded: new Date(),
        ...reviewFlagsFromMatch(match),
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, leadId: updated.id, existing: true });
  }

  const lead = await prisma.crmLeadPipeline.create({
    data: {
      contactId: contact.id,
      campaignId: campaign.id,
      additionalNotes,
      conflictCheckStatus: "REVIEW_REQUIRED",
      sourceType: "MANUAL",
      ...reviewFlagsFromMatch(match),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, leadId: lead.id, existing: false });
}
