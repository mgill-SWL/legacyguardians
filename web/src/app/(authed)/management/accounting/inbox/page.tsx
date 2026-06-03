import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { BookkeepingInboxClient } from "./ui";
import { ReviewQueueClient } from "./ReviewQueueClient";

export const dynamic = "force-dynamic";

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function jsonString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export default async function AccountingInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const cardAccount = await prisma.financialAccount.upsert({
    where: { firmId_name: { firmId: user.activeFirmId, name: "CHASE CARD" } },
    update: { kind: "CREDIT_CARD", active: true },
    create: { firmId: user.activeFirmId, name: "CHASE CARD", kind: "CREDIT_CARD", active: true },
  });

  await prisma.financialImportBatch.updateMany({
    where: { firmId: user.activeFirmId, source: "CARD_CSV", accountId: null },
    data: { accountId: cardAccount.id },
  });

  await prisma.rawFinancialTransaction.updateMany({
    where: { firmId: user.activeFirmId, source: "CARD_CSV", accountId: null },
    data: { accountId: cardAccount.id },
  });

  const rawWithoutReview = await prisma.rawFinancialTransaction.findMany({
    where: {
      firmId: user.activeFirmId,
      reviewItems: { none: {} },
    },
    select: { id: true },
    orderBy: [{ createdAt: "desc" }],
    take: 1000,
  });

  if (rawWithoutReview.length) {
    await prisma.transactionReviewItem.createMany({
      data: rawWithoutReview.map((tx) => ({ rawTransactionId: tx.id, status: "UNREVIEWED" })),
      skipDuplicates: true,
    });
  }

  const items = await prisma.transactionReviewItem.findMany({
    where: {
      status: { in: ["UNREVIEWED", "NEEDS_INFO"] },
      rawTransaction: {
        firmId: user.activeFirmId,
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 250,
    include: {
      rawTransaction: { include: { account: true } },
    },
  });

  const recentBatches = await prisma.financialImportBatch.findMany({
    where: { firmId: user.activeFirmId },
    orderBy: [{ createdAt: "desc" }],
    take: 12,
    include: {
      account: true,
      _count: { select: { rawTransactions: true } },
    },
  });

  const coaTable = await prisma.reportTable.findUnique({ where: { slug: "chart-of-accounts" }, include: { rows: true } });
  const coa = (coaTable?.rows || [])
    .map((r) => {
      const data = jsonRecord(r.data);
      return {
        number: String(r.label || r.rowKey || "").trim(),
        name: String(data.account || "").trim(),
        type: String(data.type || "").trim(),
      };
    })
    .filter((c) => c.number && c.name);

  const shaped = items.map((it) => {
    const rt = it.rawTransaction;
    const rawData = jsonRecord(rt.rawData);
    const accountBucket =
      rt.source === "CARD_CSV" ? "CARD" : rt.account?.kind === "TRUST_BANK" ? "IOLTA" : "OPERATING";

    return {
      id: it.id,
      status: it.status,
      createdAt: it.createdAt.toISOString(),
      accountBucket,
      raw: {
        id: rt.id,
        transactionDate: rt.transactionDate.toISOString(),
        amountCents: rt.amountCents,
        direction: rt.direction,
        description: rt.description,
        payee: rt.payee,
        memo: rt.memo,
        source: rt.source,
        accountName: rt.account?.name || null,
        suggestedCoaNumber: jsonString(rawData.suggestedCoaNumber),
        suggestedCoaName: jsonString(rawData.suggestedCoaName),
        codedCoaNumber: jsonString(rawData.codedCoaNumber),
      },
    } as const;
  });

  return (
    <>
      <BookkeepingInboxClient />
      <div className="sw-card sw-card-pad" style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 950 }}>Recent raw imports</div>
        <div className="sw-muted" style={{ fontSize: 12, marginTop: 6 }}>
          Bank and card CSV batches imported into the bookkeeping ledger.
        </div>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table className="sw-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Account</th>
                <th>Filename</th>
                <th style={{ textAlign: "right" }}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {recentBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>{batch.createdAt.toISOString().slice(0, 10)}</td>
                  <td style={{ fontFamily: "var(--sw-mono)", fontSize: 12 }}>{batch.source}</td>
                  <td>{batch.account?.name || (batch.source === "CARD_CSV" ? "CHASE CARD" : "—")}</td>
                  <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {batch.sourceFilename || "—"}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{batch._count.rawTransactions}</td>
                </tr>
              ))}
              {recentBatches.length === 0 ? (
                <tr>
                  <td className="sw-muted" colSpan={5} style={{ padding: 14 }}>
                    No raw bank/card CSV imports yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <ReviewQueueClient items={shaped} coa={coa} />
    </>
  );
}
