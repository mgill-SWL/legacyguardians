import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { message: string };

const DEFAULT_TOPICS = [
  {
    slug: "pipelines",
    title: "Pipelines (Kanban)",
    tags: ["pipeline", "kanban"],
    body:
      "Go to Management → Pipelines.\n\n- Add a matter to a pipeline: open a pipeline board and click ‘Add matter’.\n- Move a matter between stages: drag the card to another column.\n- Remove a card from a pipeline: click ✕ on the card (this does not delete the matter).\n- Stage setup + colors: go to Pipeline setup (/pipeline/settings).",
  },
  {
    slug: "leads-convert",
    title: "Leads → Convert to Client",
    tags: ["lead", "convert", "ra"],
    body:
      "Go to Leads → All leads.\n\nUse the Convert button to mark RA signed and create:\n- a canonical Client Contact\n- a Matter linked to that contact\n\nFee paid (closed) is still tracked separately.",
  },
  {
    slug: "contacts",
    title: "Contacts (Clients / Vendors / Referrers)",
    tags: ["contact", "referrer", "vendor"],
    body:
      "Go to Clients → Contacts.\n\nA contact can have multiple categories (Client, Vendor, Referrer).",
  },
  {
    slug: "management-pages",
    title: "Vivid Vision + Core Values",
    tags: ["vivid vision", "core values"],
    body:
      "Go to Management → Vivid Vision or Management → Core Values.\n\nEveryone can read. Admins can click Edit to update the text.",
  },
] as const;

async function ensureSeeded() {
  const count = await prisma.helpTopic.count();
  if (count > 0) return;

  await prisma.helpTopic.createMany({
    data: DEFAULT_TOPICS.map((t) => ({
      slug: t.slug,
      title: t.title,
      body: t.body,
      tags: t.tags as unknown as string[],
    })),
  });
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

  await ensureSeeded();

  const topics = await prisma.helpTopic.findMany({ take: 50 });
  const ranked = topics
    .map((t) => ({ t, s: scoreTopic(msg, t.title, t.body) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);

  const best = ranked[0]?.t;

  if (!best || ranked[0].s === 0) {
    return NextResponse.json({
      ok: true,
      reply:
        "I don’t have a good match yet. Try asking about: Pipelines, Leads → Convert, Contacts, Vivid Vision/Core Values.",
      suggestions: topics.slice(0, 6).map((t) => ({ slug: t.slug, title: t.title })),
    });
  }

  return NextResponse.json({
    ok: true,
    reply: best.body,
    suggestions: ranked.map((r) => ({ slug: r.t.slug, title: r.t.title })),
  });
}
