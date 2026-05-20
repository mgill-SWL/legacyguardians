import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const fieldTypes = ["TEXT", "LONG_TEXT", "DATE", "CURRENCY", "NUMBER", "TRUE_FALSE", "PICKLIST", "MULTI_SELECT_PICKLIST", "USER", "CONTACT", "LOOKUP"] as const;
const patchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  type: z.enum(fieldTypes).optional(),
  helpText: z.string().trim().max(500).optional().nullable(),
  required: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  options: z.array(z.string().trim().min(1).max(120)).optional(),
  lookupTarget: z.string().trim().max(80).optional().nullable(),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { role: true, activeFirmId: true } });
  if (!user) return { ok: false as const, status: 401, error: "user not found" };
  if (user.role !== "ADMIN") return { ok: false as const, status: 403, error: "forbidden" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };
  return { ok: true as const, firmId: user.activeFirmId };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ fieldId: string }> }) {
  const access = await requireAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { fieldId } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "invalid field" }, { status: 400 });

  const existing = await prisma.matterFieldDefinition.findFirst({ where: { id: fieldId, firmId: access.firmId } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const field = await prisma.matterFieldDefinition.update({
    where: { id: fieldId },
    data: {
      label: parsed.data.label,
      type: parsed.data.type,
      helpText: parsed.data.helpText === undefined ? undefined : parsed.data.helpText || null,
      required: parsed.data.required,
      active: parsed.data.active,
      sortOrder: parsed.data.sortOrder,
      options: parsed.data.options === undefined ? undefined : parsed.data.options,
      lookupTarget: parsed.data.lookupTarget === undefined ? undefined : parsed.data.lookupTarget || null,
    },
  });

  return NextResponse.json({ field });
}
