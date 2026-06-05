import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import {
  createDocumensoEnvelope,
  distributeDocumensoEnvelope,
  type DocumensoRecipientInput,
} from "@/lib/documenso/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

function safeJsonParse<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function cleanRecipients(input: unknown): DocumensoRecipientInput[] {
  if (!Array.isArray(input)) return [];
  return input.reduce<DocumensoRecipientInput[]>((items, item, index) => {
    if (!item || typeof item !== "object") return items;
    const row = item as Record<string, unknown>;
    const name = String(row.name || "").trim();
    const email = String(row.email || "").trim().toLowerCase();
    if (!name || !email || !email.includes("@")) return items;
    items.push({
      name,
      email,
      role: row.role === "APPROVER" || row.role === "CC" || row.role === "VIEWER" ? row.role : "SIGNER",
      signingOrder: Number(row.signingOrder) || index + 1,
    });
    return items;
  }, []);
}

async function requireActiveFirm() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, activeFirmId: true },
  });
  if (!user) return { ok: false as const, status: 401, error: "unauthorized" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };

  return { ok: true as const, firmId: user.activeFirmId, userId: user.id };
}

export async function POST(req: Request) {
  const access = await requireActiveFirm();
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "PDF file is required." }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ ok: false, error: "PDF file is empty." }, { status: 400 });
  if (file.size > MAX_PDF_BYTES) return NextResponse.json({ ok: false, error: "PDF must be 25MB or smaller." }, { status: 400 });
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ ok: false, error: "Documenso envelopes require a PDF." }, { status: 400 });
  }

  const title = String(form.get("title") || file.name.replace(/\.pdf$/i, "")).trim();
  const matterId = String(form.get("matterId") || "").trim() || null;
  const templateId = String(form.get("templateId") || "").trim() || null;
  const send = String(form.get("send") || "false") === "true";
  const recipients = cleanRecipients(safeJsonParse(form.get("recipients"), []));

  if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one signer name and email is required." }, { status: 400 });
  }

  if (matterId) {
    const matter = await prisma.matter.findFirst({ where: { id: matterId, firmId: access.firmId }, select: { id: true } });
    if (!matter) return NextResponse.json({ ok: false, error: "Matter was not found for this firm." }, { status: 404 });
  }
  if (templateId) {
    const template = await prisma.documentTemplate.findFirst({
      where: { id: templateId, firmId: access.firmId },
      select: { id: true },
    });
    if (!template) return NextResponse.json({ ok: false, error: "Template was not found for this firm." }, { status: 404 });
  }

  const pdf = Buffer.from(await file.arrayBuffer());

  try {
    const created = await createDocumensoEnvelope({
      title,
      externalId: matterId ? `lg:matter:${matterId}` : undefined,
      pdf,
      filename: file.name || `${title}.pdf`,
      recipients,
    });
    const envelopeId = created.id;
    if (!envelopeId) throw new Error("Documenso did not return an envelope id.");

    const distributed = send
      ? await distributeDocumensoEnvelope({
          envelopeId,
          subject: `Signature requested: ${title}`,
          message: "Please review and sign this representation agreement.",
        })
      : null;

    const providerResponse = distributed || created;
    const signingUrls =
      providerResponse.recipients
        ?.map((recipient) => ({
          name: recipient.name,
          email: recipient.email,
          role: recipient.role,
          signingUrl: recipient.signingUrl,
        }))
        .filter((recipient) => recipient.signingUrl) || undefined;
    const providerResponseJson = JSON.parse(JSON.stringify(providerResponse)) as Prisma.InputJsonValue;

    const packet = await prisma.signingPacket.create({
      data: {
        firmId: access.firmId,
        matterId,
        templateId,
        title,
        status: send ? "SENT" : "DRAFT",
        providerEnvelopeId: envelopeId,
        providerStatus: providerResponse.status || (send ? "PENDING" : "DRAFT"),
        sourceFileName: file.name,
        recipientsJson: recipients as Prisma.InputJsonValue,
        signingUrlsJson: signingUrls as Prisma.InputJsonValue | undefined,
        providerResponseJson,
        createdByUserId: access.userId,
      },
      select: {
        id: true,
        status: true,
        providerEnvelopeId: true,
        providerStatus: true,
        signingUrlsJson: true,
      },
    });

    return NextResponse.json({ ok: true, packet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create Documenso envelope.";
    await prisma.signingPacket.create({
      data: {
        firmId: access.firmId,
        matterId,
        templateId,
        title,
        status: "ERROR",
        sourceFileName: file.name,
        recipientsJson: recipients as Prisma.InputJsonValue,
        errorMessage: message,
        createdByUserId: access.userId,
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
