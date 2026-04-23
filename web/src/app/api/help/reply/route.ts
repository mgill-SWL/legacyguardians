import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { message: string };

function expandQuery(q: string) {
  const lower = q.toLowerCase();
  const extra: string[] = [];

  // Alias common human terms to our internal labels.
  if (lower.includes("merrifield")) {
    extra.push("fairfax", "willow oaks", "8280", "suite 600");
  }

  return [q, ...extra].join(" ");
}

function scoreTopic(q: string, title: string, body: string) {
  const words = q
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length >= 3);
  const hay = `${title} ${body}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    if (hay.includes(w)) score += 1;
  }
  return score;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const msg = body?.message?.trim();
  if (!msg) return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });

  const q = expandQuery(msg);

  const topics = await prisma.helpArticle.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    take: 80,
  });

  const ranked = topics
    .map((t) => ({ t, s: scoreTopic(q, t.title, t.body) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  const best = ranked[0]?.t;

  if (!best || ranked[0].s === 0) {
    return NextResponse.json({
      ok: true,
      reply: "I don’t have a good match yet. Try rephrasing, or ask about: parking, representation overview, probate, templates, pricing.",
      suggestions: topics.slice(0, 6).map((t) => ({ slug: t.slug, title: t.title })),
    });
  }

  return NextResponse.json({
    ok: true,
    reply: best.body,
    suggestions: ranked.map((r) => ({ slug: r.t.slug, title: r.t.title })),
  });
}
