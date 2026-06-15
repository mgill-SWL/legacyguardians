import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import type { Prisma } from "@prisma/client";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { key: string; value: string };

function parseNumberLike(s: string): number | null {
  const cleaned = (s || "")
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePercentLike(s: string): number | null {
  const raw = (s || "").trim();
  if (!raw) return null;

  const hasPct = raw.includes("%");
  const cleaned = raw.replace(/%/g, "").trim().replace(/,/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;

  // Store percents as fractions (0-1).
  if (hasPct) return n / 100;
  return n > 1 ? n / 100 : n;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string; rowId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { slug, rowId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.key) return NextResponse.json({ ok: false, error: "key required" }, { status: 400 });

  const table = await prisma.reportTable.findUnique({ where: { slug } });
  if (!table) return NextResponse.json({ ok: false, error: "table not found" }, { status: 404 });

  const row = await prisma.reportRow.findFirst({ where: { id: rowId, tableId: table.id } });
  if (!row) return NextResponse.json({ ok: false, error: "row not found" }, { status: 404 });

  const col = await prisma.reportColumn.findUnique({
    where: { tableId_key: { tableId: table.id, key: body.key } },
  });
  if (!col) return NextResponse.json({ ok: false, error: "column not found" }, { status: 404 });

  const data = (row.data as Record<string, unknown> | null) || {};

  // Parse & store typed values so downstream calculations/formatting behave.
  if (col.type === "NUMBER" || col.type === "CURRENCY") {
    const n = parseNumberLike(body.value);
    data[body.key] = n == null ? null : n;
  } else if (col.type === "PERCENT") {
    const n = parsePercentLike(body.value);
    data[body.key] = n == null ? null : n;
  } else if (col.type === "DATE") {
    data[body.key] = body.value.trim() || null;
  } else {
    data[body.key] = body.value;
  }

  await prisma.reportRow.update({ where: { id: rowId }, data: { data: data as Prisma.InputJsonValue } });

  return NextResponse.json({ ok: true });
}
