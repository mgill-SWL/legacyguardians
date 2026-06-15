import type { FinancialClassificationType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function sha1(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function norm(s: string) {
  return String(s || "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyPattern(payee: string) {
  let s = norm(payee);
  s = s.replace(/[0-9]{4,}/g, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[\-\*\/#\\]+$/g, "").trim();
  return s;
}

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

async function ensurePayeeRulesTable(firmId: string) {
  const SLUG = "payee-rules";
  const existing = await prisma.reportTable.findUnique({ where: { slug: SLUG }, include: { columns: true } });
  if (existing) return existing;

  return prisma.reportTable.create({
    data: {
      slug: SLUG,
      firmId,
      name: "Payee rules",
      columns: {
        create: [
          { key: "match_type", label: "Match", type: "TEXT", sortOrder: 0 },
          { key: "pattern", label: "Pattern", type: "TEXT", sortOrder: 1 },
          { key: "applies_to", label: "Applies to", type: "TEXT", sortOrder: 2 },
          { key: "coa_number", label: "COA #", type: "TEXT", sortOrder: 3 },
          { key: "classification", label: "Classification", type: "TEXT", sortOrder: 4 },
          { key: "confidence", label: "Confidence", type: "NUMBER", sortOrder: 5 },
        ],
      },
      rows: { create: [] },
    },
    include: { columns: true },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const actor = await prisma.user.findUnique({ where: { email } });
  if (!actor?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: actor.activeFirmId, userId: actor.id } } });
  if (!canBookkeep({ userRole: actor.role, memberKind: member?.kind, memberRole: member?.role })) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        coaNumber?: string;
        classificationType?: string;
        rememberPayee?: boolean;
      }
    | null;

  if (!body?.classificationType) {
    return NextResponse.json({ ok: false, error: "classificationType required" }, { status: 400 });
  }

  const classificationType = body.classificationType as FinancialClassificationType;
  const coaNumber = String(body.coaNumber || "").trim();
  const rememberPayee = !!body.rememberPayee;

  const item = await prisma.transactionReviewItem.findUnique({
    where: { id },
    include: {
      rawTransaction: { include: { account: true } },
    },
  });

  if (!item) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (item.rawTransaction.firmId !== actor.activeFirmId) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const isIgnore = String(classificationType).toUpperCase() === "IGNORE";
  if (!isIgnore && !coaNumber) {
    return NextResponse.json({ ok: false, error: "coaNumber required (unless IGNORE)" }, { status: 400 });
  }

  const now = new Date();

  // Create a classification record (MVP: store COA in notes + rawData).
  if (!isIgnore) {
    await prisma.financialClassification.create({
      data: {
        rawTransactionId: item.rawTransactionId,
        classificationType,
        effectiveDate: item.rawTransaction.transactionDate,
        amountCents: item.rawTransaction.amountCents,
        notes: `coa=${coaNumber}`,
        createdByUserId: actor.id,
      },
    });

    // Stamp chosen COA on rawData (so UI can show it even before we build rich joins).
    await prisma.rawFinancialTransaction.update({
      where: { id: item.rawTransactionId },
      data: {
        rawData: {
          ...(item.rawTransaction.rawData as Record<string, unknown>),
          codedCoaNumber: coaNumber,
          codedAt: now.toISOString(),
        },
      },
    });
  }

  const nextStatus = isIgnore ? ("IGNORED" as const) : ("MATCHED" as const);
  await prisma.transactionReviewItem.update({
    where: { id: item.id },
    data: {
      status: nextStatus,
      reviewedAt: now,
      reviewedByUserId: actor.id,
    },
  });

  // Optional: remember payee rule.
  if (!isIgnore && rememberPayee) {
    const payee = item.rawTransaction.payee || item.rawTransaction.description;
    const pattern = simplifyPattern(payee || "");

    if (pattern) {
      const appliesTo =
        item.rawTransaction.source === "CARD_CSV"
          ? "CARD"
          : item.rawTransaction.account?.kind === "TRUST_BANK"
            ? "IOLTA"
            : "OPERATING";

      const table = await ensurePayeeRulesTable(actor.activeFirmId);
      const rowKey = `auto:${sha1(`${appliesTo}|${pattern}`)}`;
      const label = `${appliesTo}: ${pattern}`;
      const data = {
        match_type: "CONTAINS",
        pattern,
        applies_to: appliesTo,
        coa_number: coaNumber,
        classification: "EXPENSE",
        confidence: 100,
        source: "review_queue",
      };

      const existing = await prisma.reportRow.findUnique({ where: { tableId_rowKey: { tableId: table.id, rowKey } } });
      if (existing) {
        await prisma.reportRow.update({ where: { id: existing.id }, data: { label, data: { ...(existing.data as Record<string, unknown>), ...data } } });
      } else {
        const maxSort = await prisma.reportRow.aggregate({ where: { tableId: table.id }, _max: { sortOrder: true } });
        await prisma.reportRow.create({
          data: {
            tableId: table.id,
            rowKey,
            label,
            sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
            data,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}

