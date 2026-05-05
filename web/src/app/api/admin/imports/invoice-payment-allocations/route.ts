import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { parseInvoicePaymentAllocations, type InvoicePaymentDetailRow } from "@/lib/kpi/invoicePaymentAllocations";
import { prisma } from "@/lib/prisma";

function normalizeDate(raw: string): Date {
  return new Date(`${raw.replaceAll("/", "-")}T00:00:00.000Z`);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) {
    return NextResponse.json({ error: "Signed-in user has no active firm" }, { status: 400 });
  }

  const formData = await request.formData();
  const detailFile = formData.get("detailFile");
  const transactionsFile = formData.get("transactionsFile");
  const accountsFile = formData.get("accountsFile");

  if (!(detailFile instanceof File) || !(transactionsFile instanceof File) || !(accountsFile instanceof File)) {
    return NextResponse.json({ error: "detailFile, transactionsFile, and accountsFile are required" }, { status: 400 });
  }

  const [detailCsv, transactionsCsv, accountsCsv] = await Promise.all([
    detailFile.text(),
    transactionsFile.text(),
    accountsFile.text(),
  ]);

  const parsed = parseInvoicePaymentAllocations({ detailCsv, transactionsCsv, accountsCsv });

  const importBatch = await prisma.kpiImportBatch.create({
    data: {
      firmId: user.activeFirmId,
      sourceSystem: "COSMOLEX",
      reportType: "INVOICE_PAYMENT_ALLOCATIONS",
      status: "IMPORTED",
      sourceFilename: detailFile.name,
      uploadedByUserId: user.id,
    },
  });

  const importedRows: Array<InvoicePaymentDetailRow & { source?: string }> = [];

  await prisma.$transaction(async (tx) => {
    for (const row of parsed.detailRows as Array<InvoicePaymentDetailRow & { source?: string }>) {
      const notes = [
        row.source ? `source=${row.source}` : null,
        row.reimbursedDirectUsd ? `reimbursed_direct=${row.reimbursedDirectUsd.toFixed(2)}` : null,
        row.reimbursedIndirectUsd ? `reimbursed_indirect=${row.reimbursedIndirectUsd.toFixed(2)}` : null,
      ]
        .filter(Boolean)
        .join("; ");

      await tx.matterFinancialEvent.create({
        data: {
          firmId: user.activeFirmId!,
          matterId: null,
          importBatchId: importBatch.id,
          createdByUserId: user.id,
          eventType: "PAYMENT_RECEIVED",
          eventDate: normalizeDate(row.appliedDate),
          amountCents: Math.round(row.feeIncomeUsd * 100),
          currency: "USD",
          sourceSystem: "COSMOLEX",
          sourceReference: detailFile.name,
          sourceInvoiceNumber: row.invoiceNumber,
          sourceClientName: row.clientMatter,
          sourceMatterName: row.clientMatter,
          notes,
          attributions: {
            create: {
              displayName: row.matterOwner,
              role: "TIMEKEEPER",
              amountCents: Math.round(row.feeIncomeUsd * 100),
            },
          },
        },
      });

      importedRows.push(row);
    }
  });

  return NextResponse.json({
    ok: true,
    importBatchId: importBatch.id,
    importedRows: importedRows.length,
    feeIncomeTotalUsd: importedRows.reduce((sum, row) => sum + row.feeIncomeUsd, 0),
    reimbursedDirectTotalUsd: importedRows.reduce((sum, row) => sum + row.reimbursedDirectUsd, 0),
    reimbursedIndirectTotalUsd: importedRows.reduce((sum, row) => sum + row.reimbursedIndirectUsd, 0),
    accountTotals: parsed.accountTotals,
  });
}
