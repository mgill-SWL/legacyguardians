import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { renderDocxTemplateBuffer } from "@/lib/docx/renderTemplate";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type QuoteLineInput = {
  label?: string;
  amountCents?: number;
  summary?: string;
};

type GenerateBody = {
  salesperson?: string;
  office?: string;
  source?: string;
  spouseName?: string;
  totalCents?: number;
  paymentTerm?: string;
  attorneyTier?: string;
  attorneyName?: string;
  notes?: string;
  quoteLines?: QuoteLineInput[];
};

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function cleanText(input: unknown) {
  return String(input || "").trim();
}

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function safeFilename(input: string) {
  return input.replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(date);
}

async function requireActiveFirm() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, activeFirmId: true, name: true },
  });
  if (!user) return { ok: false as const, status: 401, error: "unauthorized" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };

  return { ok: true as const, firmId: user.activeFirmId, userId: user.id, userName: user.name || "" };
}

function buildMergeData(input: {
  body: GenerateBody;
  lead: {
    contact: { firstName: string; lastName: string; email: string | null; phoneE164: string };
    campaign: { name: string; slug: string };
    additionalNotes: string | null;
    spouseFirstName: string | null;
    spouseLastName: string | null;
    spouseEmail: string | null;
    spousePhone: string | null;
  };
}) {
  const clientName = `${input.lead.contact.firstName} ${input.lead.contact.lastName}`.trim() || "Unnamed Client";
  const totalCents = Number(input.body.totalCents) || 0;
  const quoteLines = Array.isArray(input.body.quoteLines)
    ? input.body.quoteLines
        .map((line) => ({
          label: cleanText(line.label),
          amount: dollars(Number(line.amountCents) || 0),
          amountCents: Number(line.amountCents) || 0,
          summary: cleanText(line.summary),
        }))
        .filter((line) => line.label)
    : [];
  const quoteLinesText = quoteLines.map((line) => `${line.label}: ${line.amount}${line.summary ? ` - ${line.summary}` : ""}`).join("\n");

  // Spouse comes from the lead record (the durable home — see the lead page's
  // "Spouse / co-client" card). A spouse name typed on the proposal still wins
  // if present, for backward compatibility.
  const leadSpouseName = [input.lead.spouseFirstName, input.lead.spouseLastName]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(" ");
  const spouseName = cleanText(input.body.spouseName) || leadSpouseName;
  const spouseEmail = (input.lead.spouseEmail || "").trim();
  const spousePhone = (input.lead.spousePhone || "").trim();

  const data = {
    CLIENTNAME: clientName,
    ClientName: clientName,
    ClientFullName: clientName,
    CLIENTFULLNAME: clientName,
    SpouseFullName: spouseName,
    SPOUSEFULLNAME: spouseName,
    SpouseName: spouseName,
    SPOUSENAME: spouseName,
    SpouseEmail: spouseEmail,
    SPOUSEEMAIL: spouseEmail,
    SpousePhone: spousePhone,
    SPOUSEPHONE: spousePhone,
    CLIENTFIRSTNAME: input.lead.contact.firstName,
    ClientFirstName: input.lead.contact.firstName,
    CLIENTLASTNAME: input.lead.contact.lastName,
    ClientLastName: input.lead.contact.lastName,
    CLIENTEMAIL: input.lead.contact.email || "",
    ClientEmail: input.lead.contact.email || "",
    CLIENTPHONE: input.lead.contact.phoneE164,
    ClientPhone: input.lead.contact.phoneE164,
    DATE: formatDate(),
    Date: formatDate(),
    Today: formatDate(),
    TODAY: formatDate(),
    SALESPERSON: cleanText(input.body.salesperson),
    Salesperson: cleanText(input.body.salesperson),
    LEADATTORNEY: cleanText(input.body.attorneyName),
    LeadAttorney: cleanText(input.body.attorneyName),
    ATTORNEYTIER: cleanText(input.body.attorneyTier),
    AttorneyTier: cleanText(input.body.attorneyTier),
    OFFICE: cleanText(input.body.office),
    Office: cleanText(input.body.office),
    SOURCE: cleanText(input.body.source) || input.lead.campaign.name || input.lead.campaign.slug,
    Source: cleanText(input.body.source) || input.lead.campaign.name || input.lead.campaign.slug,
    CAMPAIGN: input.lead.campaign.name,
    Campaign: input.lead.campaign.name,
    TOTALFEE: dollars(totalCents),
    TotalFee: dollars(totalCents),
    FEE: dollars(totalCents),
    Fee: dollars(totalCents),
    PAYMENTTERM: cleanText(input.body.paymentTerm),
    PaymentTerm: cleanText(input.body.paymentTerm),
    QUOTELINES: quoteLinesText,
    QuoteLines: quoteLinesText,
    // Array form for table-row loops in DOCX templates:
    // [[#QuoteLineItems]] [[label]] [[amount]] [[summary]] [[/QuoteLineItems]]
    QuoteLineItems: quoteLines,
    NOTES: cleanText(input.body.notes) || input.lead.additionalNotes || "",
    Notes: cleanText(input.body.notes) || input.lead.additionalNotes || "",
  };

  return data;
}

export async function POST(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const access = await requireActiveFirm();
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  const { leadId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as GenerateBody;

  const lead = await prisma.crmLeadPipeline.findFirst({
    where: { id: leadId, contact: { firmId: access.firmId } },
    include: { campaign: true, contact: true },
  });
  if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });

  const template = await prisma.documentTemplate.findFirst({
    where: { firmId: access.firmId, kind: "REPRESENTATION_AGREEMENT", active: true },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, name: true, sourceFileName: true, mimeType: true, content: true },
  });
  if (!template) {
    return NextResponse.json({ ok: false, error: "No active representation agreement template is uploaded." }, { status: 400 });
  }
  if (template.mimeType !== DOCX_MIME && !template.sourceFileName.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ ok: false, error: "The active representation agreement template must be a DOCX file." }, { status: 400 });
  }

  const mergeData = buildMergeData({ body, lead });
  const rendered = renderDocxTemplateBuffer({
    buffer: Buffer.from(template.content),
    data: mergeData,
  });
  const clientName = `${lead.contact.firstName} ${lead.contact.lastName}`.trim() || "Client";
  const fileName = `${safeFilename(clientName)}_Representation_Agreement_${new Date().toISOString().slice(0, 10)}.docx`;
  const mergeDataJson = JSON.parse(JSON.stringify(mergeData)) as Prisma.InputJsonValue;
  const content = Uint8Array.from(rendered.buffer);

  const draft = await prisma.representationAgreementDraft.create({
    data: {
      firmId: access.firmId,
      leadId: lead.id,
      templateId: template.id,
      title: `${clientName} Representation Agreement`,
      sourceFileName: template.sourceFileName,
      fileName,
      mimeType: DOCX_MIME,
      sizeBytes: rendered.buffer.byteLength,
      content,
      mergeData: mergeDataJson,
      missingTokens: rendered.missingTokens,
      createdByUserId: access.userId,
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      status: true,
      missingTokens: true,
      createdAt: true,
    },
  });

  await prisma.crmLeadPipeline.update({
    where: { id: lead.id },
    data: {
      proposalPreparedAt: new Date(),
      raPreparedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    draft: {
      ...draft,
      downloadHref: `/api/crm/representation-agreements/${draft.id}/download`,
    },
  });
}
