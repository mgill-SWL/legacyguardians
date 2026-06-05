import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_TEMPLATE_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "application/msword",
  "text/html",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set(["docx", "pdf", "doc", "html", "htm", "txt"]);

type DocumentTemplateKind = "REPRESENTATION_AGREEMENT" | "HR_DOCUMENT" | "CONSENT" | "AUTHORIZATION" | "ACKNOWLEDGEMENT";

const VALID_KINDS = new Set<DocumentTemplateKind>([
  "REPRESENTATION_AGREEMENT",
  "HR_DOCUMENT",
  "CONSENT",
  "AUTHORIZATION",
  "ACKNOWLEDGEMENT",
]);

function slugifyKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
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
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ ok: false, error: "file is empty" }, { status: 400 });
  if (file.size > MAX_TEMPLATE_BYTES) return NextResponse.json({ ok: false, error: "file must be 20MB or smaller" }, { status: 400 });

  const kindRaw = String(form.get("kind") || "REPRESENTATION_AGREEMENT").trim() as DocumentTemplateKind;
  if (!VALID_KINDS.has(kindRaw)) return NextResponse.json({ ok: false, error: "invalid template kind" }, { status: 400 });

  const name = String(form.get("name") || "").trim() || file.name.replace(/\.[^.]+$/, "");
  const key = slugifyKey(String(form.get("key") || "").trim() || name);
  const description = String(form.get("description") || "").trim() || null;
  const active = String(form.get("active") || "true") !== "false";
  const ext = extensionOf(file.name);

  if (!key) return NextResponse.json({ ok: false, error: "key is required" }, { status: 400 });
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "template must be DOCX, PDF, DOC, HTML, or plain text" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    const template = await prisma.documentTemplate.create({
      data: {
        firmId: access.firmId,
        key,
        name,
        kind: kindRaw,
        description,
        sourceFileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        content: bytes,
        active,
        createdByUserId: access.userId,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: template.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ ok: false, error: "a template with that key already exists" }, { status: 409 });
    }
    throw error;
  }
}
