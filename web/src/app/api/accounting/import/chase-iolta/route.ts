import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

function parseIsoDate(s: string): Date {
  const t = s.trim();
  const m = t.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
  if (!m) throw new Error(`Invalid date: ${s}`);
  return new Date(`${t}T00:00:00.000Z`);
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function normPayee(s: string) {
  return String(s || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function loadCoaMap() {
  try {
    const coa = await prisma.reportTable.findUnique({ where: { slug: "chart-of-accounts" }, include: { rows: true } });
    const m = new Map<string, string>();
    for (const r of coa?.rows || []) {
      const num = String(r.label || r.rowKey || "").trim();
      const name = String((r.data as any)?.account || "").trim();
      if (num) m.set(num, name);
    }
    return m;
  } catch {
    return new Map<string, string>();
  }
}

type PayeeRule = { matchType: "CONTAINS" | "EXACT"; pattern: string; appliesTo: "CARD" | "OPERATING" | "IOLTA" | "ANY"; coaNumber: string; classification: string };

async function loadPayeeRules(): Promise<PayeeRule[]> {
  try {
    const t = await prisma.reportTable.findUnique({ where: { slug: "payee-rules" }, include: { rows: { orderBy: { sortOrder: "asc" } } } });
    return (t?.rows || [])
      .map((r) => {
        const d: any = r.data || {};
        const matchType = String(d.match_type || "CONTAINS").toUpperCase();
        const appliesTo = String(d.applies_to || "ANY").toUpperCase();
        const pattern = String(d.pattern || r.label || "");
        const coaNumber = String(d.coa_number || "").trim();
        const classification = String(d.classification || "EXPENSE").toUpperCase();
        if (!pattern.trim() || !coaNumber) return null;
        return {
          matchType: matchType === "EXACT" ? "EXACT" : "CONTAINS",
          pattern: normPayee(pattern),
          appliesTo: (appliesTo === "CARD" || appliesTo === "OPERATING" || appliesTo === "IOLTA" ? appliesTo : "ANY") as any,
          coaNumber,
          classification,
        } as PayeeRule;
      })
      .filter(Boolean) as PayeeRule[];
  } catch {
    return [];
  }
}

function applyPayeeRules({ payee, appliesTo, rules }: { payee: string; appliesTo: PayeeRule["appliesTo"]; rules: PayeeRule[] }) {
  const p = normPayee(payee);
  for (const r of rules) {
    if (!(r.appliesTo === "ANY" || r.appliesTo === appliesTo)) continue;
    if (r.matchType === "EXACT" && p === r.pattern) return r;
    if (r.matchType === "CONTAINS" && p.includes(r.pattern)) return r;
  }
  return null;
}

function toCents(raw: string) {
  const n = Number(String(raw).replaceAll(",", "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
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

  const text = await file.text();
  const rows = parseCsv(text);
  if (!rows.length) return NextResponse.json({ ok: false, error: "empty CSV" }, { status: 400 });

  const headers = rows[0].map((h) => h.trim().replace(/^"|"$/g, ""));
  const idx = (h: string) => headers.indexOf(h);
  const required = ["Account Name", "Processed Date", "Description", "Check Number", "Credit or Debit", "Amount"];
  for (const h of required) {
    if (idx(h) < 0) return NextResponse.json({ ok: false, error: `missing header: ${h}` }, { status: 400 });
  }

  // IOLTA account (trust bank)
  const accountName = "IOLTA";
  const account = await prisma.financialAccount.upsert({
    where: { firmId_name: { firmId: user.activeFirmId, name: accountName } },
    update: { kind: "TRUST_BANK", active: true },
    create: { firmId: user.activeFirmId, name: accountName, kind: "TRUST_BANK", active: true },
  });

  const batch = await prisma.financialImportBatch.create({
    data: {
      firmId: user.activeFirmId,
      source: "BANK_CSV",
      accountId: account.id,
      sourceFilename: file.name,
      importedByUserId: user.id,
    },
  });

  const [coaMap, payeeRules] = await Promise.all([loadCoaMap(), loadPayeeRules()]);

  type Parsed = {
    processedDate: string;
    description: string;
    checkNumber: string;
    creditOrDebit: string;
    amount: string;
    accountNameRaw: string;
  };

  const parsed: Parsed[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row?.length) continue;
    const get = (h: string) => String(row[idx(h)] ?? "");
    const accountNameRaw = get("Account Name").trim().replace(/^"|"$/g, "");
    const processedDate = get("Processed Date").trim();
    const description = get("Description").trim().replace(/^"|"$/g, "");
    const checkNumber = get("Check Number").trim().replace(/^"|"$/g, "");
    const creditOrDebit = get("Credit or Debit").trim().replace(/^"|"$/g, "");
    const amount = get("Amount").trim().replace(/^"|"$/g, "");
    if (!processedDate && !description && !amount) continue;
    parsed.push({ accountNameRaw, processedDate, description, checkNumber, creditOrDebit, amount });
  }

  const txData = parsed.map((r) => {
    const d = parseIsoDate(r.processedDate);
    const amtCents = toCents(r.amount);
    const isCredit = r.creditOrDebit.toLowerCase() === "credit";
    const direction = isCredit ? ("INFLOW" as const) : ("OUTFLOW" as const);
    const description = r.description || "(no description)";
    const externalReference = r.checkNumber ? `check:${r.checkNumber}` : null;

    // Default: don't auto-suggest COA in trust/IOLTA unless user explicitly adds applies_to=IOLTA rules.
    const suggested = direction === "OUTFLOW" ? applyPayeeRules({ payee: description, appliesTo: "IOLTA", rules: payeeRules }) : null;
    const suggestedCoaName = suggested?.coaNumber ? coaMap.get(suggested.coaNumber) || null : null;

    const dedupe = sha256(
      [
        user.activeFirmId,
        "BANK_CSV",
        accountName,
        r.accountNameRaw || "",
        d.toISOString().slice(0, 10),
        direction,
        String(Math.abs(amtCents)),
        description,
        externalReference || "",
      ].join("|")
    );

    return {
      firmId: user.activeFirmId!,
      accountId: account.id,
      importBatchId: batch.id,
      source: "BANK_CSV" as const,
      transactionDate: d,
      postedDate: d,
      amountCents: Math.abs(amtCents),
      direction,
      payee: description,
      description,
      memo: null,
      externalReference,
      rawData: {
        accountName: r.accountNameRaw,
        creditOrDebit: r.creditOrDebit,
        checkNumber: r.checkNumber || null,
        suggestedCoaNumber: suggested?.coaNumber || null,
        suggestedCoaName,
        suggestedClassification: suggested?.classification || null,
      },
      dedupeHash: dedupe,
    };
  });

  const created = await prisma.rawFinancialTransaction.createMany({
    data: txData,
    skipDuplicates: true,
  });

  const raw = await prisma.rawFinancialTransaction.findMany({
    where: { importBatchId: batch.id },
    select: { id: true },
  });
  const ids = raw.map((r) => r.id);
  const existingReview = await prisma.transactionReviewItem.findMany({
    where: { rawTransactionId: { in: ids } },
    select: { rawTransactionId: true },
  });
  const has = new Set(existingReview.map((r) => r.rawTransactionId));
  const missing = ids.filter((id) => !has.has(id));
  if (missing.length) {
    await prisma.transactionReviewItem.createMany({
      data: missing.map((id) => ({ rawTransactionId: id, status: "UNREVIEWED" })),
    });
  }

  return NextResponse.json({ ok: true, batchId: batch.id, parsedRows: parsed.length, insertedRows: created.count });
}
