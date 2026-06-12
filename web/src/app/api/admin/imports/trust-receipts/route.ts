import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { dedupeHashesForRows } from "@/lib/kpi/importDedupe";
import { parseTrustReceiptsJournal } from "@/lib/kpi/trustJournal";
import { prisma } from "@/lib/prisma";

function normalizeDate(raw: string): Date {
  return new Date(`${raw.replaceAll("/", "-")}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) {
    return NextResponse.json({ error: "Signed-in user has no active firm" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const parsed = parseTrustReceiptsJournal(await file.text());

  // Skip rows already imported (e.g. the same journal re-uploaded), so a
  // re-import cannot double-count trust deposits.
  const hashes = dedupeHashesForRows(
    parsed.map((row) => [
      "TRUST_RECEIPTS_JOURNAL",
      row.date,
      row.amountUsd.toFixed(2),
      row.receivedFrom,
      row.clientMatter,
      row.purposeOfFunds ?? "",
      row.method ?? "",
    ])
  );
  const existing = hashes.length
    ? await prisma.matterFinancialEvent.findMany({
        where: { firmId: user.activeFirmId, dedupeHash: { in: hashes } },
        select: { dedupeHash: true },
      })
    : [];
  const existingHashes = new Set(existing.map((e) => e.dedupeHash));
  const newRows = parsed
    .map((row, i) => ({ row, dedupeHash: hashes[i] }))
    .filter((x) => !existingHashes.has(x.dedupeHash));

  const trustAccount = await prisma.billingAccount.upsert({
    where: { firmId_name: { firmId: user.activeFirmId, name: "Trust" } },
    update: { accountType: "TRUST", active: true },
    create: {
      firmId: user.activeFirmId,
      name: "Trust",
      accountType: "TRUST",
      sourceSystem: "MANUAL",
      active: true,
    },
  });

  const batch = await prisma.kpiImportBatch.create({
    data: {
      firmId: user.activeFirmId,
      sourceSystem: "COSMOLEX",
      reportType: "TRUST_RECEIPTS_JOURNAL",
      status: "IMPORTED",
      sourceFilename: file.name,
      uploadedByUserId: user.id,
    },
  });

  await prisma.$transaction(async (tx) => {
    for (const { row, dedupeHash } of newRows) {
      await tx.matterFinancialEvent.create({
        data: {
          firmId: user.activeFirmId!,
          matterId: null,
          importBatchId: batch.id,
          createdByUserId: user.id,
          eventType: "TRUST_DEPOSIT",
          eventDate: normalizeDate(row.date),
          amountCents: Math.round(row.amountUsd * 100),
          currency: "USD",
          sourceSystem: "COSMOLEX",
          sourceReference: file.name,
          sourceClientName: row.receivedFrom,
          sourceMatterName: row.clientMatter,
          dedupeHash,
          toAccountId: trustAccount.id,
          notes: [row.purposeOfFunds ? `purpose=${row.purposeOfFunds}` : null, row.method ? `method=${row.method}` : null]
            .filter(Boolean)
            .join("; "),
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    importBatchId: batch.id,
    parsedRows: parsed.length,
    importedRows: newRows.length,
    skippedDuplicateRows: parsed.length - newRows.length,
    amountTotalUsd: newRows.reduce((sum, x) => sum + x.row.amountUsd, 0),
  });
}
