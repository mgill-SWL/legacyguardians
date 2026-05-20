import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ values: z.record(z.string(), z.unknown()) });

async function requireUserAndMatter(matterId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, activeFirmId: true } });
  if (!user) return { ok: false as const, status: 401, error: "user not found" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };
  const matter = await prisma.matter.findUnique({ where: { id: matterId }, select: { id: true, firmId: true, displayName: true } });
  if (!matter) return { ok: false as const, status: 404, error: "matter not found" };
  if (!matter.firmId) await prisma.matter.update({ where: { id: matter.id }, data: { firmId: user.activeFirmId } });
  else if (matter.firmId !== user.activeFirmId) return { ok: false as const, status: 403, error: "matter not in active firm" };
  return { ok: true as const, user, firmId: user.activeFirmId, matter };
}

function normalizeValue(type: string, raw: unknown) {
  if (raw === "" || raw === null || raw === undefined) return null;
  if (type === "TRUE_FALSE") return raw === true || raw === "true";
  if (type === "NUMBER") {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error("number fields must contain a valid number");
    return n;
  }
  if (type === "CURRENCY") {
    const n = Number(String(raw).replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n)) throw new Error("currency fields must contain a valid amount");
    return Math.round(n * 100);
  }
  if (type === "MULTI_SELECT_PICKLIST") return Array.isArray(raw) ? raw.map(String) : [];
  return String(raw);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const { matterId } = await ctx.params;
  const access = await requireUserAndMatter(matterId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "invalid field values" }, { status: 400 });

  const fields = await prisma.matterFieldDefinition.findMany({ where: { firmId: access.firmId, active: true } });
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const existing = await prisma.matterFieldValue.findMany({ where: { matterId } });
  const existingByFieldId = new Map(existing.map((v) => [v.fieldDefinitionId, v]));

  const changed: Array<{ key: string; label: string; previous: unknown; next: unknown }> = [];
  for (const [key, raw] of Object.entries(parsed.data.values)) {
    const field = byKey.get(key);
    if (!field) continue;
    let next: unknown;
    try {
      next = normalizeValue(field.type, raw);
    } catch (err) {
      return NextResponse.json({ error: `${field.label}: ${err instanceof Error ? err.message : "invalid value"}` }, { status: 400 });
    }
    const prev = existingByFieldId.get(field.id)?.value ?? null;
    if (JSON.stringify(prev) === JSON.stringify(next)) continue;

    await prisma.matterFieldValue.upsert({
      where: { matterId_fieldDefinitionId: { matterId, fieldDefinitionId: field.id } },
      create: { matterId, fieldDefinitionId: field.id, value: next as object, updatedByUserId: access.user.id },
      update: { value: next as object, updatedByUserId: access.user.id },
    });
    changed.push({ key: field.key, label: field.label, previous: prev, next });
  }

  if (changed.length) {
    await prisma.matterTimelineEvent.create({
      data: {
        firmId: access.firmId,
        matterId,
        actorUserId: access.user.id,
        eventType: "MATTER_FIELD_UPDATED",
        title: `Matter fields updated: ${changed.map((c) => c.label).join(", ")}`,
        details: { changed } as Prisma.InputJsonValue,
      },
    });
  }

  return NextResponse.json({ ok: true, changed });
}
