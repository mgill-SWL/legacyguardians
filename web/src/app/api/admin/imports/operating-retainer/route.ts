import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { parseOperatingRetainerByMatter } from "@/lib/kpi/operatingRetainer";
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

  const parsed = parseOperatingRetainerByMatter(await file.text());

  const batch = await prisma.kpiImportBatch.create({
    data: {
      firmId: user.activeFirmId,
      sourceSystem: "COSMOLEX",
      reportType: "OPERATING_RETAINER_BY_MATTER",
      status: "IMPORTED",
      sourceFilename: file.name,
      uploadedByUserId: user.id,
    },
  });

  let fundingRows = 0;
  let applicationRows = 0;
  let negativeBalanceRows = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of parsed) {
      if (row.inferredKind === "funding") fundingRows += 1;
      if (row.inferredKind === "application") applicationRows += 1;
      if (row.balanceUsd < 0) negativeBalanceRows += 1;

      await tx.matterFinancialEvent.create({
        data: {
          firmId: user.activeFirmId!,
          matterId: null,
          importBatchId: batch.id,
          createdByUserId: user.id,
          eventType: row.inferredKind === "funding" ? "OPERATING_DEPOSIT" : "PAYMENT_RECEIVED",
          eventDate: normalizeDate(row.date),
          amountCents: Math.round(Math.abs(row.deltaUsd) * 100),
          currency: "USD",
          sourceSystem: "COSMOLEX",
          sourceReference: file.name,
          sourceInvoiceNumber: row.invoiceNumber,
          sourceClientName: row.clientId,
          sourceMatterName: row.matterName,
          notes: [
            `operating_retainer_kind=${row.inferredKind}`,
            row.transTypeMethodRef ? `trans_type=${row.transTypeMethodRef.replaceAll("\n", " ")}` : null,
            row.payorPayeeMemo ? `memo=${row.payorPayeeMemo.replaceAll("\n", " ")}` : null,
            `balance=${row.balanceUsd.toFixed(2)}`,
            row.balanceUsd < 0 ? "negative_retainer_balance=true" : null,
          ]
            .filter(Boolean)
            .join("; "),
          attributions: row.matterOwner
            ? {
                create: {
                  displayName: row.matterOwner,
                  role: "LEAD_ATTORNEY",
                  amountCents: Math.round(Math.abs(row.deltaUsd) * 100),
                },
              }
            : undefined,
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    importBatchId: batch.id,
    importedRows: parsed.length,
    fundingRows,
    applicationRows,
    negativeBalanceRows,
  });
}
