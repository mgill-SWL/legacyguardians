import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import * as XLSX from "xlsx";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SLUG = "payee-rules";

const DEFAULT_COLUMNS: { key: string; label: string; type: any }[] = [
  { key: "match_type", label: "Match", type: "TEXT" },
  { key: "pattern", label: "Pattern", type: "TEXT" },
  { key: "applies_to", label: "Applies to", type: "TEXT" },
  { key: "coa_number", label: "COA #", type: "TEXT" },
  { key: "classification", label: "Classification", type: "TEXT" },
  { key: "confidence", label: "Confidence", type: "NUMBER" },
];

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

async function ensureTable(firmId: string) {
  const existing = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: true, rows: true },
  });

  if (!existing) {
    return prisma.reportTable.create({
      data: {
        slug: SLUG,
        firmId,
        name: "Payee rules",
        columns: { create: DEFAULT_COLUMNS.map((c, idx) => ({ key: c.key, label: c.label, type: c.type, sortOrder: idx })) },
        rows: { create: [] },
      },
      include: { columns: true, rows: true },
    });
  }

  const byKey = new Set(existing.columns.map((c) => c.key));
  let next = existing.columns.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1;
  for (const c of DEFAULT_COLUMNS) {
    if (byKey.has(c.key)) continue;
    await prisma.reportColumn.create({ data: { tableId: existing.id, key: c.key, label: c.label, type: c.type, sortOrder: next++ } });
  }

  return prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: true, rows: true },
  });
}

function norm(s: string) {
  return String(s || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyPattern(payee: string) {
  // Heuristic: strip long digit runs and trailing ref-like tokens.
  let s = norm(payee);
  s = s.replace(/[0-9]{4,}/g, "");
  s = s.replace(/\s+/g, " ").trim();
  // If we end with a dangling punctuation token, trim it.
  s = s.replace(/[\-\*\/#\\]+$/g, "").trim();
  return s;
}

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

type AppliesTo = "CARD" | "OPERATING" | "IOLTA";

function guessAppliesTo(accountHeader: string): AppliesTo {
  const h = norm(accountHeader);
  if (h.includes("CREDIT CARD")) return "CARD";
  if (h.includes("IOLTA") || h.includes("TRUST")) return "IOLTA";
  return "OPERATING";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "file is required" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return NextResponse.json({ ok: false, error: "no sheets" }, { status: 400 });

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: true, blankrows: false }) as any[][];

  // Parse report blocks.
  // We look for header row: Date | Ref# | Payee | Description | Account | Debit | Credit | Balance
  const HEADER = ["Date", "Ref#", "Payee", "Description", "Account", "Debit", "Credit", "Balance"].map(norm);

  type Obs = { appliesTo: AppliesTo; coaNumber: string; count: number; totalCents: number };
  const obsByPayee = new Map<string, Map<string, Obs>>(); // payeeNorm -> key(appliesTo|coaNumber) -> obs

  let currentAccountHeader = "";
  let inTable = false;
  let col: Record<string, number> | null = null;

  const toCents = (v: any) => {
    const n = typeof v === "number" ? v : Number(String(v ?? "").replaceAll(",", ""));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const first = String(r[0] ?? "");

    // Detect account header like "1000:... (Bank)"
    if (/^[0-9]{3,5}:.+\(.+\)$/.test(first.trim())) {
      currentAccountHeader = first.trim();
      inTable = false;
      col = null;
      continue;
    }

    // Detect table header
    const rowNorm = r.slice(0, 8).map((x: any) => norm(String(x ?? "")));
    const isHeader = HEADER.every((h, idx) => rowNorm[idx] === h);
    if (isHeader) {
      inTable = true;
      col = {
        date: 0,
        ref: 1,
        payee: 2,
        desc: 3,
        account: 4,
        debit: 5,
        credit: 6,
        balance: 7,
      };
      continue;
    }

    if (!inTable || !col) continue;

    const date = String(r[col.date] ?? "").trim();
    if (!/^20[0-9]{2}\/[0-9]{2}\/[0-9]{2}$/.test(date)) {
      // Non-transaction rows (opening balance, totals, blanks)
      continue;
    }

    const payee = String(r[col.payee] ?? "").trim();
    const account = String(r[col.account] ?? "").trim();
    if (!payee || !account || account === "--Split--") continue;

    const m = account.match(/^([0-9]{3,5})\s*:/);
    if (!m) continue;
    const coaNumber = m[1];

    // Only build rules for expense-ish accounts (5xxx/6xxx) for now.
    if (!(coaNumber.startsWith("5") || coaNumber.startsWith("6"))) continue;

    const debitCents = toCents(r[col.debit]);
    const creditCents = toCents(r[col.credit]);
    const outflowCents = creditCents || debitCents; // depending on how the bank ledger prints; keep simple.
    if (outflowCents <= 0) continue;

    const appliesTo = guessAppliesTo(currentAccountHeader);

    const payeeKey = norm(payee);
    const k = `${appliesTo}|${coaNumber}`;
    const byK = obsByPayee.get(payeeKey) || new Map<string, Obs>();
    const prev = byK.get(k) || { appliesTo, coaNumber, count: 0, totalCents: 0 };
    prev.count += 1;
    prev.totalCents += outflowCents;
    byK.set(k, prev);
    obsByPayee.set(payeeKey, byK);
  }

  // Pick best mapping per payee.
  const suggestions: {
    match_type: "CONTAINS";
    pattern: string;
    applies_to: AppliesTo;
    coa_number: string;
    classification: "EXPENSE";
    confidence: number;
    sortScore: number;
  }[] = [];

  for (const [payeeNorm, byK] of obsByPayee.entries()) {
    const arr = Array.from(byK.values());
    arr.sort((a, b) => b.count - a.count || b.totalCents - a.totalCents);
    const top = arr[0];
    if (!top) continue;

    const totalCount = arr.reduce((s, x) => s + x.count, 0);
    const confidence = totalCount ? Math.round((top.count / totalCount) * 100) : 0;

    const pattern = simplifyPattern(payeeNorm);
    if (!pattern) continue;

    // Skip ultra-generic patterns.
    if (pattern.length < 4) continue;

    const sortScore = pattern.length * 10 + top.count;

    suggestions.push({
      match_type: "CONTAINS",
      pattern,
      applies_to: top.appliesTo,
      coa_number: top.coaNumber,
      classification: "EXPENSE",
      confidence,
      sortScore,
    });
  }

  // Sort: more specific first, then higher confidence.
  suggestions.sort((a, b) => b.sortScore - a.sortScore || b.confidence - a.confidence);

  const table = await ensureTable(user.activeFirmId);
  if (!table) return NextResponse.json({ ok: false, error: "failed to ensure payee-rules table" }, { status: 500 });

  const existingRows = await prisma.reportRow.findMany({ where: { tableId: table.id } });
  const existingByKey = new Map(existingRows.map((r) => [r.rowKey, r] as const));

  const maxToInsert = 250;
  let created = 0;
  let updated = 0;

  for (let i = 0; i < Math.min(maxToInsert, suggestions.length); i++) {
    const s = suggestions[i];
    const rowKey = `gl:${sha1(`${s.applies_to}|${s.pattern}|${s.coa_number}`)}`;
    const data = {
      match_type: s.match_type,
      pattern: s.pattern,
      applies_to: s.applies_to,
      coa_number: s.coa_number,
      classification: s.classification,
      confidence: s.confidence,
    } as any;

    const ex = existingByKey.get(rowKey);
    if (ex) {
      await prisma.reportRow.update({ where: { id: ex.id }, data: { data: { ...(ex.data as any), ...data } } });
      updated++;
    } else {
      await prisma.reportRow.create({
        data: {
          tableId: table.id,
          rowKey,
          label: `${s.applies_to}: ${s.pattern}`,
          sortOrder: existingRows.length + created,
          data,
        },
      });
      created++;
    }
  }

  return NextResponse.json({ ok: true, sheet: sheetName, suggestions: suggestions.length, created, updated, inserted: created + updated });
}

