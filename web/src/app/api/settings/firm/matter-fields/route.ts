import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const fieldTypes = ["TEXT", "LONG_TEXT", "DATE", "CURRENCY", "NUMBER", "TRUE_FALSE", "PICKLIST", "MULTI_SELECT_PICKLIST", "USER", "CONTACT", "LOOKUP"] as const;
const createSchema = z.object({
  label: z.string().trim().min(1).max(120),
  key: z.string().trim().min(1).max(80).regex(/^[a-z][a-z0-9_]*$/, "key must start with a lowercase letter and use lowercase letters, numbers, underscores"),
  type: z.enum(fieldTypes),
  helpText: z.string().trim().max(500).optional().nullable(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(120)).optional(),
  lookupTarget: z.string().trim().max(80).optional().nullable(),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };
  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, role: true, activeFirmId: true } });
  if (!user) return { ok: false as const, status: 401, error: "user not found" };
  if (user.role !== "ADMIN") return { ok: false as const, status: 403, error: "forbidden" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };
  return { ok: true as const, user, firmId: user.activeFirmId };
}

export async function POST(req: Request) {
  const access = await requireAdmin();
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "invalid field" }, { status: 400 });

  const max = await prisma.matterFieldDefinition.aggregate({ where: { firmId: access.firmId }, _max: { sortOrder: true } });
  const field = await prisma.matterFieldDefinition.create({
    data: {
      firmId: access.firmId,
      key: parsed.data.key,
      label: parsed.data.label,
      type: parsed.data.type,
      helpText: parsed.data.helpText || null,
      required: parsed.data.required ?? false,
      options: parsed.data.options?.length ? parsed.data.options : undefined,
      lookupTarget: parsed.data.lookupTarget || null,
      sortOrder: (max._max.sortOrder ?? 0) + 10,
    },
  });

  return NextResponse.json({ field });
}
