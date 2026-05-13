import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SLUG = "chart-of-accounts";

const DEFAULT_COLUMNS: { key: string; label: string; type: "TEXT" | "NUMBER" | "CURRENCY" }[] = [
  { key: "account", label: "Account", type: "TEXT" },
  { key: "type", label: "Type", type: "TEXT" },
  { key: "balance", label: "Balance", type: "CURRENCY" },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    if (row.length === 1 && row[0] === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }

    if (ch === "\r") {
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  pushField();
  if (row.length) pushRow();
  return rows;
}

async function ensureTable(firmId: string) {
  const existing = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
  });

  if (!existing) {
    return prisma.reportTable.create({
      data: {
        slug: SLUG,
        firmId,
        name: "Chart of Accounts",
        columns: { create: DEFAULT_COLUMNS.map((c, i) => ({ key: c.key, label: c.label, type: c.type, sortOrder: i })) },
        rows: { create: [] },
      },
      include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
    });
  }

  // Backfill missing columns if table was created earlier.
  const byKey = new Set(existing.columns.map((c) => c.key));
  let next = existing.columns.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;
  for (const c of DEFAULT_COLUMNS) {
    if (byKey.has(c.key)) continue;
    await prisma.reportColumn.create({
      data: { tableId: existing.id, key: c.key, label: c.label, type: c.type, sortOrder: next++ },
    });
  }

  return prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  // v1: only global ADMIN can edit firm settings/report tables.
  if (user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return NextResponse.json({ ok: false, error: "empty CSV" }, { status: 400 });

  const headers = rows[0].map((h) => String(h ?? "").trim());
  const idx = (h: string) => headers.indexOf(h);
  const required = ["Number", "Account", "Type", "Balance"];
  for (const h of required) {
    if (idx(h) < 0) return NextResponse.json({ ok: false, error: `missing header: ${h}` }, { status: 400 });
  }

  const table = await ensureTable(user.activeFirmId);
  if (!table) return NextResponse.json({ ok: false, error: "failed to ensure table" }, { status: 500 });

  const existing = await prisma.reportRow.findMany({ where: { tableId: table.id } });
  const byKey = new Map(existing.map((r) => [r.rowKey, r] as const));

  let created = 0;
  let updated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row?.length) continue;
    const number = String(row[idx("Number")] ?? "").trim();
    const account = String(row[idx("Account")] ?? "").trim();
    const type = String(row[idx("Type")] ?? "").trim();
    const balance = String(row[idx("Balance")] ?? "").trim();
    if (!number) continue;

    const dataPatch: any = { account, type, balance: balance === "" ? null : Number(balance) };
    const ex = byKey.get(number);
    if (ex) {
      await prisma.reportRow.update({ where: { id: ex.id }, data: { label: number, data: { ...(ex.data as any), ...dataPatch } } });
      updated++;
    } else {
      await prisma.reportRow.create({
        data: {
          tableId: table.id,
          rowKey: number,
          label: number,
          sortOrder: existing.length + created,
          data: dataPatch,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, slug: SLUG, created, updated });
}

