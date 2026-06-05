import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  key?: string;
  name?: string;
  description?: string | null;
  kind?: "REPRESENTATION_AGREEMENT" | "HR_DOCUMENT" | "CONSENT" | "AUTHORIZATION" | "ACKNOWLEDGEMENT";
  active?: boolean;
};

const VALID_KINDS = new Set(["REPRESENTATION_AGREEMENT", "HR_DOCUMENT", "CONSENT", "AUTHORIZATION", "ACKNOWLEDGEMENT"]);

function slugifyKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function requireActiveFirm() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { ok: false as const, status: 401, error: "unauthorized" };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true, role: true },
  });
  if (!user) return { ok: false as const, status: 401, error: "unauthorized" };
  if (!user.activeFirmId) return { ok: false as const, status: 400, error: "no active firm" };

  return { ok: true as const, firmId: user.activeFirmId, isAdmin: user.role === "ADMIN" };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireActiveFirm();
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });
  if (body.kind && !VALID_KINDS.has(body.kind)) return NextResponse.json({ ok: false, error: "invalid template kind" }, { status: 400 });

  const { id } = await ctx.params;
  const r = await prisma.documentTemplate.updateMany({
    where: { id, firmId: access.firmId },
    data: {
      key: body.key === undefined ? undefined : slugifyKey(body.key),
      name: body.name?.trim() || undefined,
      description: body.description === undefined ? undefined : body.description?.trim() || null,
      kind: body.kind,
      active: body.active,
    },
  });

  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireActiveFirm();
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  if (!access.isAdmin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const r = await prisma.documentTemplate.deleteMany({ where: { id, firmId: access.firmId } });
  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
