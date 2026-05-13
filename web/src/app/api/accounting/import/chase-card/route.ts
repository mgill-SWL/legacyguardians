import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Row = {
  Card: string;
  "Transaction Date": string;
  "Post Date": string;
  Description: string;
  Category: string;
  Type: string;
  Amount: string;
  Memo: string;
};

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
    // ignore completely empty trailing row
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
        // escaped quote
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
      // ignore CR (handle CRLF)
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // flush last field/row
  pushField();
  if (row.length) pushRow();

  return rows;
}

function parseMdy(s: string): Date {
  // Chase export is M/D/YYYY
  const m = s.trim().match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
  if (!m) throw new Error(`Invalid date: ${s}`);
  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);
  // Store as UTC midnight.
  return new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
}

function toCents(raw: string): { cents: number; direction: "INFLOW" | "OUTFLOW" } {
  const n = Number(String(raw).replaceAll(",", "").trim());
  if (!Number.isFinite(n)) return { cents: 0, direction: "OUTFLOW" };
  const dir = n >= 0 ? "INFLOW" : "OUTFLOW";
  return { cents: Math.round(Math.abs(n) * 100), direction: dir };
}

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
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

  const headers = rows[0].map((h) => h.trim());
  const idx = (h: string) => headers.indexOf(h);
  const required = ["Card", "Transaction Date", "Post Date", "Description", "Category", "Type", "Amount", "Memo"];
  for (const h of required) {
    if (idx(h) < 0) return NextResponse.json({ ok: false, error: `missing header: ${h}` }, { status: 400 });
  }

  const parsed: Row[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row?.length) continue;
    const get = (h: string) => String(row[idx(h)] ?? "");
    const Card = get("Card").trim();
    const TransactionDate = get("Transaction Date").trim();
    const PostDate = get("Post Date").trim();
    const Description = get("Description").trim();
    const Category = get("Category").trim();
    const Type = get("Type").trim();
    const Amount = get("Amount").trim();
    const Memo = get("Memo").trim();
    if (!Card && !TransactionDate && !PostDate && !Description && !Amount) continue;
    parsed.push({
      Card,
      "Transaction Date": TransactionDate,
      "Post Date": PostDate,
      Description,
      Category,
      Type,
      Amount,
      Memo,
    });
  }

  const batch = await prisma.financialImportBatch.create({
    data: {
      firmId: user.activeFirmId,
      source: "CARD_CSV",
      sourceFilename: file.name,
      importedByUserId: user.id,
    },
  });

  const txData = parsed.map((r) => {
    const tDate = parseMdy(r["Transaction Date"]);
    const pDate = parseMdy(r["Post Date"]);
    const amt = toCents(r.Amount);
    const description = r.Description || "(no description)";
    const memo = r.Memo || null;
    const cardLast4 = r.Card || null;
    const chaseType = r.Type || null;
    const chaseCategory = r.Category || null;

    const dedupe = sha256(
      [
        user.activeFirmId,
        "CARD_CSV",
        cardLast4 || "",
        tDate.toISOString().slice(0, 10),
        pDate.toISOString().slice(0, 10),
        String(amt.direction),
        String(amt.cents),
        description,
        memo || "",
        chaseType || "",
      ].join("|")
    );

    return {
      firmId: user.activeFirmId!,
      accountId: null,
      importBatchId: batch.id,
      source: "CARD_CSV" as const,
      transactionDate: tDate,
      postedDate: pDate,
      amountCents: amt.cents,
      direction: amt.direction,
      payee: description,
      description,
      memo,
      externalReference: null,
      rawData: {
        cardLast4,
        chaseCategory,
        chaseType,
        chaseAmountRaw: r.Amount,
      },
      dedupeHash: dedupe,
    };
  });

  const created = await prisma.rawFinancialTransaction.createMany({
    data: txData,
    skipDuplicates: true,
  });

  // Ensure review items exist (idempotent-ish: skip ones already having any review item).
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

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    parsedRows: parsed.length,
    insertedRows: created.count,
  });
}

