import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  slug: string;
  title: string;
  format?: "MARKDOWN" | "HTML" | "PLAINTEXT";
  body: string;
  tags?: string[];
  published?: boolean;
  sortOrder?: number;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const firmId = user.activeFirmId;
  if (!firmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.slug?.trim() || !body?.title?.trim() || !body?.body?.trim()) {
    return NextResponse.json({ ok: false, error: "slug, title, body required" }, { status: 400 });
  }

  const count = await prisma.helpArticle.count();

  const a = await prisma.helpArticle.create({
    data: {
      firmId,
      slug: body.slug.trim(),
      title: body.title.trim(),
      format: (body.format || "MARKDOWN") as any,
      body: body.body,
      tags: body.tags || [],
      published: body.published ?? true,
      sortOrder: body.sortOrder ?? count,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: a.id });
}
