import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  slug?: string;
  title?: string;
  format?: "MARKDOWN" | "HTML" | "PLAINTEXT";
  body?: string;
  tags?: string[];
  published?: boolean;
  sortOrder?: number;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const firmId = user.activeFirmId;
  if (!firmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

  const r = await prisma.helpArticle.updateMany({
    where: { id, firmId },
    data: {
      slug: body.slug?.trim() ? body.slug.trim() : undefined,
      title: body.title?.trim() ? body.title.trim() : undefined,
      format: body.format as any,
      body: body.body === undefined ? undefined : body.body,
      tags: body.tags === undefined ? undefined : body.tags,
      published: body.published === undefined ? undefined : body.published,
      sortOrder: body.sortOrder === undefined ? undefined : body.sortOrder,
    },
  });

  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const firmId = user.activeFirmId;
  if (!firmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;
  const r = await prisma.helpArticle.deleteMany({ where: { id, firmId } });
  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
