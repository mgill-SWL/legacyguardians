import { timingSafeEqual } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024 * 1024;

function secretsMatch(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Documenso webhook events that change our packet lifecycle status.
const EVENT_TO_STATUS: Record<string, "COMPLETED" | "REJECTED"> = {
  DOCUMENT_COMPLETED: "COMPLETED",
  DOCUMENT_REJECTED: "REJECTED",
};

export async function POST(req: Request) {
  const expected = process.env.DOCUMENSO_WEBHOOK_SECRET || "";
  if (!expected) {
    // Fail closed: never accept webhooks until a secret is configured.
    return NextResponse.json({ ok: false, error: "webhook not configured" }, { status: 503 });
  }

  const provided = req.headers.get("x-documenso-secret") || "";
  if (!provided || !secretsMatch(provided, expected)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const event = typeof rec.event === "string" ? rec.event : "";
  const payload =
    rec.payload && typeof rec.payload === "object" ? (rec.payload as Record<string, unknown>) : {};

  // Documenso payload shapes vary by version; try the known id fields.
  const candidateIds = [payload.envelopeId, payload.id, payload.documentId, payload.secondaryId]
    .map((v) => (v === null || v === undefined ? "" : String(v)))
    .filter(Boolean);

  if (candidateIds.length === 0) {
    return NextResponse.json({ ok: true, matched: false, reason: "no envelope id in payload" });
  }

  const packet = await prisma.signingPacket.findFirst({
    where: { provider: "DOCUMENSO", providerEnvelopeId: { in: candidateIds } },
    select: { id: true, status: true },
  });

  // Acknowledge unknown envelopes with 200 so Documenso does not retry forever.
  if (!packet) {
    return NextResponse.json({ ok: true, matched: false, reason: "no matching signing packet" });
  }

  const mappedStatus = EVENT_TO_STATUS[event];
  const providerStatus =
    typeof payload.status === "string" && payload.status ? payload.status : event || undefined;

  await prisma.signingPacket.update({
    where: { id: packet.id },
    data: {
      // Never downgrade a completed packet on late/out-of-order events.
      ...(mappedStatus && packet.status !== "COMPLETED" ? { status: mappedStatus } : {}),
      ...(providerStatus ? { providerStatus } : {}),
      providerResponseJson: JSON.parse(
        JSON.stringify({ webhook: { event, payload, receivedAt: new Date().toISOString() } })
      ) as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, matched: true, packetId: packet.id });
}
