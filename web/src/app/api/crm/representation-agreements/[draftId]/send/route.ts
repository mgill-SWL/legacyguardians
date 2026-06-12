import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import {
  createDocumensoEnvelope,
  createDocumensoEnvelopeFields,
  distributeDocumensoEnvelope,
  type DocumensoFieldInput,
  type DocumensoRecipientInput,
} from "@/lib/documenso/client";
import { prisma } from "@/lib/prisma";
import { fieldsFromAnchors, findSigningAnchors } from "@/lib/signing/pdfAnchors";

export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Sends an approved representation agreement PDF for signature.
 *
 * The PDF must be exported from a template containing signing anchors
 * (tiny white "@@SIG1@@"/"@@DATE1@@"/"@@SIG2@@"/"@@DATE2@@" markers).
 * Signature and date fields are placed automatically at the anchors, the
 * envelope is sent through Documenso, and the resulting packet is linked to
 * the lead so the webhook stamps the RA-signed milestone on completion.
 */
export async function POST(req: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });
  const firmId = user.activeFirmId;

  const { draftId } = await ctx.params;
  const draft = await prisma.representationAgreementDraft.findFirst({
    where: { id: draftId, firmId },
    include: { lead: { include: { contact: true } } },
  });
  if (!draft) return NextResponse.json({ ok: false, error: "draft not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "The approved PDF is required." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ ok: false, error: "PDF must be non-empty and 25MB or smaller." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ ok: false, error: "Signing requires a PDF (export the reviewed DOCX as PDF first)." }, { status: 400 });
  }

  const contact = draft.lead.contact;
  const signer1Name = String(form.get("signer1Name") || `${contact.firstName} ${contact.lastName}`).trim();
  const signer1Email = String(form.get("signer1Email") || contact.email || "").trim().toLowerCase();
  const signer2Name = String(form.get("signer2Name") || "").trim();
  const signer2Email = String(form.get("signer2Email") || "").trim().toLowerCase();

  if (!signer1Email || !isValidEmail(signer1Email)) {
    return NextResponse.json(
      { ok: false, error: "Signer 1 needs a valid email (the lead has no email on file — enter one)." },
      { status: 400 }
    );
  }

  const pdf = Buffer.from(await file.arrayBuffer());

  // Locate the invisible signing anchors in the final, attorney-approved PDF.
  let anchors;
  try {
    anchors = await findSigningAnchors(pdf);
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read the PDF. Re-export it from Word and try again." }, { status: 422 });
  }

  if (anchors.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No signing anchors found in this PDF. It must be exported from the current tokenized template (the anchors are invisible markers at each signature line). If you edited the document, keep the signature blocks intact.",
      },
      { status: 422 }
    );
  }

  const needsSigner2 = anchors.some((a) => a.signer === 2);
  if (needsSigner2 && (!signer2Email || !isValidEmail(signer2Email))) {
    return NextResponse.json(
      { ok: false, error: "This agreement has signature lines for a second signer — enter the spouse's name and email." },
      { status: 400 }
    );
  }

  const recipients: DocumensoRecipientInput[] = [
    { name: signer1Name || "Client", email: signer1Email, role: "SIGNER", signingOrder: 1 },
  ];
  if (needsSigner2) {
    recipients.push({ name: signer2Name || "Client Spouse", email: signer2Email, role: "SIGNER", signingOrder: 2 });
  }

  // 1) Create the envelope and persist the packet BEFORE distribution so a
  //    mid-flow failure can never orphan the remote envelope.
  let created;
  try {
    created = await createDocumensoEnvelope({
      title: draft.title,
      externalId: `lg:lead:${draft.leadId}:ra:${draft.id}`,
      pdf,
      filename: file.name || `${draft.title}.pdf`,
      recipients,
    });
    if (!created.id) throw new Error("Documenso did not return an envelope id.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create Documenso envelope.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
  const envelopeId = created.id;

  const packet = await prisma.signingPacket.create({
    data: {
      firmId,
      leadId: draft.leadId,
      templateId: draft.templateId,
      title: draft.title,
      status: "DRAFT",
      providerEnvelopeId: envelopeId,
      providerStatus: created.status || "DRAFT",
      sourceFileName: file.name,
      recipientsJson: recipients as unknown as Prisma.InputJsonValue,
      providerResponseJson: JSON.parse(JSON.stringify(created)) as Prisma.InputJsonValue,
      createdByUserId: user.id,
    },
    select: { id: true },
  });

  // 2) Map created recipients back to our signers by email, then place
  //    signature/date fields at every anchor occurrence.
  const recipientIdByEmail = new Map<string, number>();
  for (const r of created.recipients || []) {
    if (typeof r.id === "number" && r.email) recipientIdByEmail.set(r.email.toLowerCase(), r.id);
  }
  const signer1Id = recipientIdByEmail.get(signer1Email);
  const signer2Id = needsSigner2 ? recipientIdByEmail.get(signer2Email) : undefined;
  if (!signer1Id || (needsSigner2 && !signer2Id)) {
    await prisma.signingPacket.update({
      where: { id: packet.id },
      data: { status: "ERROR", errorMessage: "Documenso did not return recipient ids; fields not placed." },
    });
    return NextResponse.json(
      { ok: false, error: "Envelope created, but Documenso did not return recipient ids. Open the envelope in Documenso to finish manually.", packetId: packet.id },
      { status: 502 }
    );
  }

  const envelopeItems = (created as Record<string, unknown>).envelopeItems;
  const envelopeItemId =
    Array.isArray(envelopeItems) && envelopeItems[0] && typeof envelopeItems[0] === "object"
      ? String((envelopeItems[0] as Record<string, unknown>).id ?? "") || undefined
      : undefined;

  const fields: DocumensoFieldInput[] = fieldsFromAnchors(anchors).map((f) => ({
    recipientId: f.signer === 2 ? (signer2Id as number) : signer1Id,
    type: f.type,
    page: f.page,
    positionX: f.positionX,
    positionY: f.positionY,
    width: f.width,
    height: f.height,
    ...(envelopeItemId ? { envelopeItemId } : {}),
  }));

  try {
    await createDocumensoEnvelopeFields({ envelopeId, fields });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not place signature fields.";
    await prisma.signingPacket.update({
      where: { id: packet.id },
      data: { status: "ERROR", errorMessage: `Field placement failed: ${message}` },
    });
    return NextResponse.json(
      { ok: false, error: `Envelope created, but field placement failed: ${message}. Open it in Documenso to place fields manually.`, packetId: packet.id },
      { status: 502 }
    );
  }

  // 3) Send it and stamp the lead's RA-sent milestone.
  try {
    const distributed = await distributeDocumensoEnvelope({
      envelopeId,
      subject: `Signature requested: ${draft.title}`,
      message: "Please review and sign this representation agreement.",
    });
    await prisma.$transaction([
      prisma.signingPacket.update({
        where: { id: packet.id },
        data: {
          status: "SENT",
          providerStatus: distributed.status || "PENDING",
          providerResponseJson: JSON.parse(JSON.stringify(distributed)) as Prisma.InputJsonValue,
        },
      }),
      prisma.representationAgreementDraft.update({
        where: { id: draft.id },
        data: { status: "SENT", sentAt: new Date() },
      }),
      prisma.crmLeadPipeline.update({
        where: { id: draft.leadId },
        data: { raSentAt: new Date() },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send the envelope.";
    await prisma.signingPacket.update({
      where: { id: packet.id },
      data: { status: "ERROR", errorMessage: `Sending failed: ${message}` },
    });
    return NextResponse.json(
      { ok: false, error: `Fields were placed, but sending failed: ${message}. Open the envelope in Documenso and send it from there.`, packetId: packet.id },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    packetId: packet.id,
    fieldsPlaced: fields.length,
    signers: recipients.map((r) => ({ name: r.name, email: r.email })),
  });
}
