const DEFAULT_DOCUMENSO_BASE_URL = "https://app.documenso.com/api/v2";

export type DocumensoRecipientInput = {
  name: string;
  email: string;
  role?: "SIGNER" | "APPROVER" | "CC" | "VIEWER";
  signingOrder?: number;
};

export type DocumensoEnvelopeResponse = {
  id?: string;
  status?: string;
  recipients?: Array<{
    id?: number;
    name?: string;
    email?: string;
    role?: string;
    signingUrl?: string;
    token?: string;
  }>;
  [key: string]: unknown;
};

export function documensoConfig() {
  return {
    apiToken: process.env.DOCUMENSO_API_TOKEN || "",
    baseUrl: (process.env.DOCUMENSO_API_BASE_URL || DEFAULT_DOCUMENSO_BASE_URL).replace(/\/+$/, ""),
  };
}

export function isDocumensoConfigured() {
  return Boolean(documensoConfig().apiToken);
}

async function documensoFetch(path: string, init: RequestInit = {}) {
  const { apiToken, baseUrl } = documensoConfig();
  if (!apiToken) throw new Error("DOCUMENSO_API_TOKEN is not configured.");

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: apiToken,
      ...(init.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String((body as { message?: unknown }).message)
        : `Documenso request failed with HTTP ${res.status}.`;
    throw new Error(message);
  }

  return body;
}

export async function getDocumensoConnectionStatus() {
  const { baseUrl } = documensoConfig();
  if (!isDocumensoConfigured()) {
    return {
      configured: false,
      ok: false,
      baseUrl,
      error: "DOCUMENSO_API_TOKEN is not configured.",
    };
  }

  try {
    const data = await documensoFetch("/envelope?type=DOCUMENT&page=1&perPage=1");
    return { configured: true, ok: true, baseUrl, data };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      baseUrl,
      error: error instanceof Error ? error.message : "Documenso connection failed.",
    };
  }
}

export async function createDocumensoEnvelope(input: {
  title: string;
  externalId?: string;
  pdf: Buffer;
  filename: string;
  recipients: DocumensoRecipientInput[];
}) {
  const form = new FormData();
  form.append(
    "payload",
    JSON.stringify({
      type: "DOCUMENT",
      title: input.title,
      externalId: input.externalId,
      recipients: input.recipients.map((recipient, index) => ({
        email: recipient.email,
        name: recipient.name,
        role: recipient.role || "SIGNER",
        signingOrder: recipient.signingOrder || index + 1,
      })),
    }),
  );
  form.append("files", new Blob([new Uint8Array(input.pdf)], { type: "application/pdf" }), input.filename);

  return (await documensoFetch("/envelope/create", {
    method: "POST",
    body: form,
  })) as DocumensoEnvelopeResponse;
}

export type DocumensoFieldInput = {
  recipientId: number;
  type: "SIGNATURE" | "DATE" | "TEXT" | "NAME" | "EMAIL" | "INITIALS";
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  envelopeItemId?: string;
};

/** Bulk-create signature/date fields on an envelope at percentage coordinates. */
export async function createDocumensoEnvelopeFields(input: {
  envelopeId: string;
  fields: DocumensoFieldInput[];
}) {
  return await documensoFetch("/envelope/field/create-many", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      envelopeId: input.envelopeId,
      data: input.fields,
    }),
  });
}

export async function distributeDocumensoEnvelope(input: {
  envelopeId: string;
  subject?: string;
  message?: string;
  timezone?: string;
}) {
  return (await documensoFetch("/envelope/distribute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      envelopeId: input.envelopeId,
      meta: {
        subject: input.subject,
        message: input.message,
        timezone: input.timezone || "America/New_York",
      },
    }),
  })) as DocumensoEnvelopeResponse;
}
