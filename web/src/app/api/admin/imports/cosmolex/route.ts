import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { parseCosmoLexReport, usdToCents } from "@/lib/kpi/cosmolex";

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
  const collectionsFile = formData.get("collectionsFile");
  const billingsFile = formData.get("billingsFile");

  if (!(collectionsFile instanceof File) || !(billingsFile instanceof File)) {
    return NextResponse.json({ error: "Both collectionsFile and billingsFile are required" }, { status: 400 });
  }

  const [collectionsText, billingsText] = await Promise.all([
    collectionsFile.text(),
    billingsFile.text(),
  ]);

  const collections = parseCosmoLexReport(collectionsText, "collections");
  const billings = parseCosmoLexReport(billingsText, "billings");

  const result = await prisma.$transaction(async (tx) => {
    const collectionsBatch = await tx.kpiImportBatch.create({
      data: {
        firmId: user.activeFirmId!,
        reportType: "COLLECTIONS_BY_TIMEKEEPER",
        status: "IMPORTED",
        sourceSystem: "COSMOLEX",
        rangeStart: collections.rangeStart ? new Date(`${collections.rangeStart}T00:00:00.000Z`) : null,
        rangeEnd: collections.rangeEnd ? new Date(`${collections.rangeEnd}T00:00:00.000Z`) : null,
        sourceFilename: collectionsFile.name,
        uploadedByUserId: user.id,
      },
    });

    const billingsBatch = await tx.kpiImportBatch.create({
      data: {
        firmId: user.activeFirmId!,
        reportType: "BILLINGS_BY_TIMEKEEPER",
        status: "IMPORTED",
        sourceSystem: "COSMOLEX",
        rangeStart: billings.rangeStart ? new Date(`${billings.rangeStart}T00:00:00.000Z`) : null,
        rangeEnd: billings.rangeEnd ? new Date(`${billings.rangeEnd}T00:00:00.000Z`) : null,
        sourceFilename: billingsFile.name,
        uploadedByUserId: user.id,
      },
    });

    for (const row of collections.sourceRows) {
      await tx.matterFinancialEvent.create({
        data: {
          firmId: user.activeFirmId!,
          matterId: null,
          importBatchId: collectionsBatch.id,
          createdByUserId: user.id,
          eventType: "PAYMENT_RECEIVED",
          eventDate: new Date(`${(row.paymentDate ?? row.invoiceDate ?? collections.rangeEnd)!}T00:00:00.000Z`),
          amountCents: usdToCents(row.collectedFeeUsd),
          currency: "USD",
          sourceSystem: "COSMOLEX",
          sourceInvoiceNumber: row.invoiceNumber || null,
          sourceMatterFileNumber: row.matterFileNumber,
          sourceClientName: row.client,
          sourceMatterName: row.matter,
          sourceReference: collectionsFile.name,
          attributions: {
            create: {
              displayName: row.timekeeper,
              role: "TIMEKEEPER",
              amountCents: usdToCents(row.collectedFeeUsd),
            },
          },
        },
      });
    }

    for (const row of billings.sourceRows) {
      await tx.matterFinancialEvent.create({
        data: {
          firmId: user.activeFirmId!,
          matterId: null,
          importBatchId: billingsBatch.id,
          createdByUserId: user.id,
          eventType: "BILLED",
          eventDate: new Date(`${(row.invoiceDate ?? billings.rangeEnd)!}T00:00:00.000Z`),
          amountCents: usdToCents(row.billedFeeUsd),
          currency: "USD",
          sourceSystem: "COSMOLEX",
          sourceInvoiceNumber: row.invoiceNumber || null,
          sourceMatterFileNumber: row.matterFileNumber,
          sourceClientName: row.client,
          sourceMatterName: row.matter,
          sourceReference: billingsFile.name,
          attributions: {
            create: {
              displayName: row.timekeeper,
              role: "TIMEKEEPER",
              amountCents: usdToCents(row.billedFeeUsd),
            },
          },
        },
      });
    }

    return {
      collectionsBatchId: collectionsBatch.id,
      billingsBatchId: billingsBatch.id,
      collectionsRows: collections.sourceRows.length,
      billingsRows: billings.sourceRows.length,
      collectionsRange: [collections.rangeStart, collections.rangeEnd],
      billingsRange: [billings.rangeStart, billings.rangeEnd],
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
