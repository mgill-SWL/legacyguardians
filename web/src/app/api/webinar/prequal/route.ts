import { NextResponse } from "next/server";

import { findIntakeMatches, reviewFlagsFromMatch } from "@/lib/crm/intakeMatching";
import { prisma } from "@/lib/prisma";
import { normalizeE164 } from "@/lib/ringcentral";
import { corsOptionsResponse, withCors } from "@/lib/webinarCors";

export const dynamic = "force-dynamic";

type Body = {
  additionalNotes?: string;
  campaignSlug?: string;
  docsInPlace?: string[];
  email?: string;
  estatePlanningStage?: string;
  estateWorthBand?: string;
  firstName?: string;
  investReady?: boolean;
  lastName?: string;
  phone?: string;
  primaryConcern?: string;
  readyToStart?: string;
  watchToken?: string;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase() || null;
}

function cleanStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 12);
}

function isQualified(body: Required<Pick<Body, "estatePlanningStage" | "estateWorthBand" | "primaryConcern" | "readyToStart">>) {
  const readyScore = ["immediately", "30-days", "90-days"].includes(body.readyToStart) ? 2 : 0;
  const stageScore = ["need-plan", "update-plan", "probate-help"].includes(body.estatePlanningStage) ? 2 : 0;
  const concernScore = body.primaryConcern && body.primaryConcern !== "other" ? 1 : 0;
  const valueScore = body.estateWorthBand && body.estateWorthBand !== "under-500k" ? 1 : 0;
  return readyScore + stageScore + concernScore + valueScore >= 4;
}

function qualityScore(qualified: boolean, readyToStart: string, estateWorthBand: string) {
  if (!qualified) return 35;
  let score = 70;
  if (readyToStart === "immediately") score += 15;
  if (readyToStart === "30-days") score += 10;
  if (estateWorthBand === "2m-5m" || estateWorthBand === "5m-plus") score += 10;
  return Math.min(score, 95);
}

export async function OPTIONS(req: Request) {
  return corsOptionsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as Body | null;

  const firstName = cleanText(body?.firstName);
  const lastName = cleanText(body?.lastName);
  const email = cleanEmail(body?.email);
  const phoneE164 = normalizeE164(body?.phone);
  const campaignSlug = cleanText(body?.campaignSlug) || "webinar-prequal";
  const estatePlanningStage = cleanText(body?.estatePlanningStage);
  const primaryConcern = cleanText(body?.primaryConcern);
  const estateWorthBand = cleanText(body?.estateWorthBand);
  const readyToStart = cleanText(body?.readyToStart);
  const docsInPlace = cleanStringArray(body?.docsInPlace);
  const additionalNotes = cleanText(body?.additionalNotes) || null;

  if (!firstName || !lastName || !phoneE164 || !estatePlanningStage || !primaryConcern || !estateWorthBand || !readyToStart) {
    return withCors(NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 }), origin);
  }

  const campaign = await prisma.crmCampaign.upsert({
    where: { slug: campaignSlug },
    create: {
      defaultSenderName: "Noah",
      name: campaignSlug.replaceAll("-", " "),
      slug: campaignSlug,
    },
    update: {},
  });

  const registration = body?.watchToken
    ? await prisma.crmRegistration.findFirst({
        where: { watchToken: body.watchToken },
        select: { id: true },
      })
    : null;

  const contact = await prisma.crmContact.upsert({
    where: { phoneE164 },
    create: {
      email,
      firstName,
      lastName,
      phoneE164,
      state: "UNKNOWN",
    },
    update: {
      email: email || undefined,
      firstName,
      lastName,
    },
  });

  const qualified = isQualified({ estatePlanningStage, estateWorthBand, primaryConcern, readyToStart });
  const answers = {
    additionalNotes,
    docsInPlace,
    email,
    estatePlanningStage,
    estateWorthBand,
    firstName,
    investReady: Boolean(body?.investReady),
    lastName,
    phone: phoneE164,
    primaryConcern,
    qualified,
    readyToStart,
    watchToken: body?.watchToken || null,
  };

  const submission = await prisma.crmPrequalSubmission.create({
    data: {
      additionalNotes,
      answers,
      campaignId: campaign.id,
      contactId: contact.id,
      docsInPlace,
      estatePlanningStage,
      estateWorthBand,
      investReady: Boolean(body?.investReady),
      primaryConcern,
      qualified,
      readyToStart,
      registrationId: registration?.id,
      source: "webinar-prequal",
    },
    select: { id: true },
  });

  const match = await findIntakeMatches({
    email,
    firstName,
    lastName,
    phoneE164,
  });

  const notes = [
    qualified ? "Webinar prequal: qualified" : "Webinar prequal: not yet qualified",
    `Stage: ${estatePlanningStage}`,
    `Concern: ${primaryConcern}`,
    `Estate band: ${estateWorthBand}`,
    `Ready: ${readyToStart}`,
    additionalNotes ? `Notes: ${additionalNotes}` : null,
  ].filter(Boolean).join("\n");

  const lead = match.exactOpenLead
    ? await prisma.crmLeadPipeline.update({
        where: { id: match.exactOpenLead.id },
        data: {
          additionalNotes: notes,
          conflictCheckStatus: "REVIEW_REQUIRED",
          leadQualityScore: qualityScore(qualified, readyToStart, estateWorthBand),
          sourceType: "FORM_FILL",
          ...reviewFlagsFromMatch(match),
        },
        select: { id: true },
      })
    : await prisma.crmLeadPipeline.upsert({
        where: { contactId_campaignId: { contactId: contact.id, campaignId: campaign.id } },
        create: {
          additionalNotes: notes,
          campaignId: campaign.id,
          conflictCheckStatus: "REVIEW_REQUIRED",
          contactId: contact.id,
          leadQualityScore: qualityScore(qualified, readyToStart, estateWorthBand),
          sourceType: "FORM_FILL",
          ...reviewFlagsFromMatch(match),
        },
        update: {
          additionalNotes: notes,
          conflictCheckStatus: "REVIEW_REQUIRED",
          leadQualityScore: qualityScore(qualified, readyToStart, estateWorthBand),
          sourceType: "FORM_FILL",
          ...reviewFlagsFromMatch(match),
        },
        select: { id: true },
      });

  await prisma.crmPrequalSubmission.update({
    where: { id: submission.id },
    data: { leadId: lead.id },
  });

  return withCors(NextResponse.json({ ok: true, leadId: lead.id, qualified, submissionId: submission.id }), origin);
}
