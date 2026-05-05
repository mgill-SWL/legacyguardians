import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { parseTrustDisbursementsJournal } from "@/lib/kpi/trustJournal";
import { prisma } from "@/lib/prisma";

function normalizeDate(raw: string): Date {
  return new Date(`${raw.replaceAll("/", "-")}T00:00:00.000Z`);
}

function classifyDisbursement(row: { paidTo: string; purposeOfPayment: string }) {
  const paidTo = row.paidTo.toLowerCase();
  const purpose = row.purposeOfPayment.toLowerCase();

  if (paidTo.includes("speedwell") && purpose.includes("trust to general transfer")) {
    return { eventType: "TRANSFER" as const, kpiCollected: true };
  }

  if (purpose.includes("refund") || purpose.includes("return")) {
    return { eventType: "REFUND" as const, kpiCollected: false };
  }

  return { eventType: "TRUST_APPLIED" as const, kpiCollected: false };
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

  const parsed = parseTrustDisbursementsJournal(await file.text());

  const batch = await prisma.kpiImportBatch.create({
    data: {
      firmId: user.activeFirmId,
      sourceSystem: "COSMOLEX",
      reportType: "TRUST_DISBURSEMENTS_JOURNAL",
      status: "IMPORTED",
      sourceFilename: file.name,
      uploadedByUserId: user.id,
    },
  });

  let transferCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of parsed) {
      const classification = classifyDisbursement(row);
      if (classification.kpiCollected) transferCount += 1;

      await tx.matterFinancialEvent.create({
        data: {
          firmId: user.activeFirmId!,
          matterId: null,
          importBatchId: batch.id,
          createdByUserId: user.id,
          eventType: classification.eventType,
          eventDate: normalizeDate(row.date),
          amountCents: Math.round(row.amountUsd * 100),
          currency: "USD",
          sourceSystem: "COSMOLEX",
          sourceReference: file.name,
          sourceClientName: row.paidTo,
          sourceMatterName: row.clientMatter,
          notes: [
            row.methodRef ? `method_ref=${row.methodRef}` : null,
            row.purposeOfPayment ? `purpose=${row.purposeOfPayment}` : null,
            classification.kpiCollected ? "kpi_collected=true" : null,
          ]
            .filter(Boolean)
            .join("; "),
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    importBatchId: batch.id,
    importedRows: parsed.length,
    amountTotalUsd: parsed.reduce((sum, row) => sum + row.amountUsd, 0),
    transferRowsMarkedCollected: transferCount,
  });
}
