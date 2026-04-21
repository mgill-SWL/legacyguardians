import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Msg = { role: "user" | "assistant"; content: string };

type Body = {
  messages: Msg[];
};

function topTerms(q: string) {
  return Array.from(
    new Set(
      q
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 4)
        .slice(0, 12)
    )
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const messages = body?.messages || [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  if (!lastUser.trim()) return NextResponse.json({ ok: false, error: "No user message" }, { status: 400 });

  const terms = topTerms(lastUser);

  const helpArticles = await prisma.helpArticle.findMany({
    where: {
      published: true,
      OR: terms.length
        ? terms.flatMap((t) => [
            { title: { contains: t, mode: "insensitive" as const } },
            { slug: { contains: t, mode: "insensitive" as const } },
            { body: { contains: t, mode: "insensitive" as const } },
          ])
        : undefined,
    },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  const feeFeatures = await prisma.feeFeature.findMany({
    where: { active: true },
    orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    take: 200,
  });

  const context = {
    helpArticles: helpArticles.map((a) => ({ slug: a.slug, title: a.title, format: a.format, body: a.body, tags: a.tags })),
    pricing: feeFeatures.map((f) => ({ key: f.key, label: f.label, group: f.group, type: f.type, moneyCents: f.moneyCents })),
  };

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      message:
        "OPENAI_API_KEY is not set on the server yet. Add it in Vercel env vars and redeploy, then I can answer using Help Topics + Pricing.",
      debugContext: context,
    });
  }

  const model = process.env["OPENAI_MODEL"] || "gpt-4o-mini";

  const system = `You are Speedwell Law's helpful operations chatbot.\n\nRules:\n- Answer ONLY using the provided Help Topics and Pricing context.\n- If the user asks something not covered, say you don't have that info yet and suggest what to ask the firm.\n- Do not provide legal advice; keep it informational.\n- Keep answers concise and friendly.\n`;

  const prompt = {
    system,
    context,
    conversation: messages.slice(-12),
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content:
            "Context (Help Topics + Pricing) as JSON:\n" + JSON.stringify(context, null, 2) +
            "\n\nConversation so far:\n" +
            messages
              .slice(-12)
              .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
              .join("\n") +
            "\n\nNow answer the last user message.",
        },
      ],
    }),
  });

  const data = await r.json().catch(() => null);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: data?.error?.message || `OpenAI error ${r.status}` }, { status: 500 });
  }

  // Responses API returns output text in output[0].content[*].text for simple generations.
  const text =
    data?.output?.flatMap((o: any) => o?.content || [])
      ?.map((c: any) => c?.text)
      ?.filter(Boolean)
      ?.join("\n") ||
    data?.output_text ||
    "";

  return NextResponse.json({ ok: true, message: text.trim() || "(empty)" });
}
