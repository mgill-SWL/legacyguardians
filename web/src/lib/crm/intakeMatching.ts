import { prisma } from "@/lib/prisma";

export type IntakeIdentity = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneE164?: string | null;
};

export type IntakeSource = "MANUAL" | "INBOUND_TEXT" | "INBOUND_CALL" | "FORM_FILL" | "WEBINAR" | "REGISTRATION" | "IMPORT";

const REVIEWABLE_LEAD_SELECT = {
  id: true,
  closed: true,
  convertedMatterId: true,
  contact: {
    select: {
      email: true,
      firstName: true,
      lastName: true,
      phoneE164: true,
    },
  },
  campaign: {
    select: {
      name: true,
      slug: true,
    },
  },
} as const;

export function normalizeEmail(input?: string | null) {
  return String(input || "").trim().toLowerCase() || null;
}

export function displayName(identity: IntakeIdentity) {
  return `${identity.firstName || ""} ${identity.lastName || ""}`.trim();
}

export function isSubstantiveInboundText(body?: string | null) {
  const text = String(body || "").trim();
  if (text.length < 12) return false;
  if (/^(stop|unsubscribe|cancel|wrong number|wrong #)$/i.test(text)) return false;
  return /[a-z]/i.test(text);
}

function nameParts(identity: IntakeIdentity) {
  return {
    firstName: String(identity.firstName || "").trim(),
    lastName: String(identity.lastName || "").trim(),
    name: displayName(identity),
  };
}

function contactFirmScope(firmId?: string | null) {
  return firmId ? [{ firmId }, { firmId: null }] : [{ firmId: null }];
}

export async function findIntakeMatches(identity: IntakeIdentity & { firmId?: string | null }) {
  const email = normalizeEmail(identity.email);
  const phoneE164 = identity.phoneE164 || null;
  const { firstName, lastName, name } = nameParts(identity);
  const firmScope = contactFirmScope(identity.firmId);

  const exactLeadOr = [
    phoneE164 ? { contact: { phoneE164 } } : null,
    email ? { contact: { email } } : null,
  ].filter(Boolean) as Array<{ contact: { phoneE164?: string; email?: string } }>;

  const [exactLeads, exactContacts, exactMatters, possibleLeadNameMatches, possibleContacts] = await Promise.all([
    exactLeadOr.length
      ? prisma.crmLeadPipeline.findMany({
          where: {
            contact: { OR: firmScope },
            OR: exactLeadOr,
          },
          orderBy: [{ dateAdded: "desc" }],
          take: 8,
          select: REVIEWABLE_LEAD_SELECT,
        })
      : [],
    phoneE164 || email
      ? prisma.contact.findMany({
          where: {
            firmId: identity.firmId || undefined,
            OR: [
              phoneE164 ? { phone: phoneE164 } : null,
              email ? { email } : null,
            ].filter(Boolean) as Array<{ phone?: string; email?: string }>,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 8,
          select: { id: true, displayName: true, email: true, phone: true },
        })
      : [],
    phoneE164 || email
      ? prisma.matter.findMany({
          where: {
            firmId: identity.firmId || undefined,
            OR: [
              phoneE164 ? { primaryPhone: phoneE164 } : null,
              email ? { primaryEmail: email } : null,
            ].filter(Boolean) as Array<{ primaryPhone?: string; primaryEmail?: string }>,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 8,
          select: { id: true, displayName: true, primaryEmail: true, primaryPhone: true, status: true },
        })
      : [],
    firstName || lastName
      ? prisma.crmLeadPipeline.findMany({
          where: {
            contact: {
              OR: firmScope,
              AND: [
                firstName ? { firstName: { contains: firstName, mode: "insensitive" } } : {},
                lastName ? { lastName: { contains: lastName, mode: "insensitive" } } : {},
              ],
            },
          },
          orderBy: [{ dateAdded: "desc" }],
          take: 5,
          select: REVIEWABLE_LEAD_SELECT,
        })
      : [],
    name
      ? prisma.contact.findMany({
          where: {
            firmId: identity.firmId || undefined,
            displayName: { contains: name, mode: "insensitive" },
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 5,
          select: { id: true, displayName: true, email: true, phone: true },
        })
      : [],
  ]);

  const exactOpenLead = exactLeads.find((lead) => !lead.closed && !lead.convertedMatterId) || null;
  const exactPriorLead = exactLeads.find((lead) => lead.closed || lead.convertedMatterId) || null;
  const possibleDuplicateCount =
    exactContacts.length +
    exactMatters.length +
    possibleLeadNameMatches.filter((lead) => lead.id !== exactOpenLead?.id).length +
    possibleContacts.length;

  return {
    exactContacts,
    exactMatters,
    exactOpenLead,
    exactPriorLead,
    hasExactDurableRecord: exactContacts.length > 0 || exactMatters.length > 0,
    possibleContacts,
    possibleDuplicateCount,
    possibleLeadNameMatches,
  };
}

function duplicateNotes(match: Awaited<ReturnType<typeof findIntakeMatches>>) {
  const notes = [];
  if (match.exactContacts.length) notes.push(`${match.exactContacts.length} exact contact match`);
  if (match.exactMatters.length) notes.push(`${match.exactMatters.length} exact matter match`);
  if (match.exactPriorLead) notes.push("prior closed/converted lead match");
  if (match.possibleLeadNameMatches.length || match.possibleContacts.length) notes.push("name-based possible duplicate");
  return notes.join("; ") || null;
}

export async function getOrCreateIntakeCampaign(sourceType: IntakeSource) {
  const campaignName =
    sourceType === "INBOUND_TEXT"
      ? "Inbound text"
      : sourceType === "INBOUND_CALL"
        ? "Inbound call"
        : sourceType === "FORM_FILL"
          ? "Form fill"
          : sourceType === "MANUAL"
            ? "Manual lead"
            : "Intake source";
  const slug = campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return prisma.crmCampaign.upsert({
    where: { slug },
    create: {
      slug,
      name: campaignName,
      defaultSenderName: "Staff",
    },
    update: { name: campaignName },
    select: { id: true, name: true, slug: true },
  });
}

export async function resolveInboundThreadToLead(input: {
  body?: string | null;
  contactId: string;
  email?: string | null;
  firmId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneE164: string;
  sourceType: Extract<IntakeSource, "INBOUND_TEXT" | "INBOUND_CALL" | "FORM_FILL">;
  threadId: string;
}) {
  const match = await findIntakeMatches(input);

  if (match.exactOpenLead) {
    await prisma.crmMessageThread.update({
      where: { id: input.threadId },
      data: {
        intakeResolutionStatus: "AUTO_ATTACHED",
        leadId: match.exactOpenLead.id,
        matchConfidence: "HIGH",
        matchSummary: "Exact phone/email matched an open lead.",
        needsConflictCheck: false,
      },
    });
    return { action: "attached", leadId: match.exactOpenLead.id };
  }

  if (match.hasExactDurableRecord || match.exactPriorLead) {
    await prisma.crmMessageThread.update({
      where: { id: input.threadId },
      data: {
        intakeResolutionStatus: "REVIEW_REQUIRED",
        matchConfidence: "HIGH",
        matchSummary: duplicateNotes(match) || "Exact record match needs intake review.",
        needsConflictCheck: true,
      },
    });
    return { action: "review_required", leadId: null };
  }

  if (!isSubstantiveInboundText(input.body)) {
    await prisma.crmMessageThread.update({
      where: { id: input.threadId },
      data: {
        intakeResolutionStatus: "UNREVIEWED",
        matchConfidence: "NONE",
        matchSummary: "Inbound item was not substantive enough to auto-create a lead.",
        needsConflictCheck: false,
      },
    });
    return { action: "left_in_inbox", leadId: null };
  }

  const campaign = await getOrCreateIntakeCampaign(input.sourceType);
  const lead = await prisma.crmLeadPipeline.upsert({
    where: { contactId_campaignId: { contactId: input.contactId, campaignId: campaign.id } },
    create: {
      additionalNotes: input.body || null,
      conflictCheckStatus: "REVIEW_REQUIRED",
      contactId: input.contactId,
      duplicateReviewStatus: match.possibleDuplicateCount ? "POSSIBLE_DUPLICATE" : "NONE",
      duplicateReviewNotes: duplicateNotes(match),
      campaignId: campaign.id,
      sourceType: input.sourceType,
    },
    update: {
      additionalNotes: input.body || undefined,
      conflictCheckStatus: "REVIEW_REQUIRED",
      duplicateReviewStatus: match.possibleDuplicateCount ? "POSSIBLE_DUPLICATE" : "NONE",
      duplicateReviewNotes: duplicateNotes(match),
      sourceType: input.sourceType,
    },
    select: { id: true },
  });

  await prisma.crmMessageThread.update({
    where: { id: input.threadId },
    data: {
      intakeResolutionStatus: match.possibleDuplicateCount ? "REVIEW_REQUIRED" : "AUTO_ATTACHED",
      leadId: lead.id,
      matchConfidence: match.possibleDuplicateCount ? "MEDIUM" : "HIGH",
      matchSummary: match.possibleDuplicateCount
        ? duplicateNotes(match) || "Possible duplicate needs intake review."
        : "Substantive inbound item created a new lead.",
      needsConflictCheck: true,
    },
  });

  return { action: "created", leadId: lead.id };
}

export function reviewFlagsFromMatch(match: Awaited<ReturnType<typeof findIntakeMatches>>) {
  return {
    duplicateReviewNotes: duplicateNotes(match),
    duplicateReviewStatus: match.possibleDuplicateCount ? "POSSIBLE_DUPLICATE" : "NONE",
  } as const;
}
