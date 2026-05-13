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

export default async function AccountingInboxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const items = await prisma.transactionReviewItem.findMany({
    where: {
      status: { in: ["UNREVIEWED", "NEEDS_INFO"] },
      rawTransaction: {
        firmId: user.activeFirmId,
        direction: "OUTFLOW",
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 250,
    include: {
      rawTransaction: { include: { account: true } },
    },
  });

  const coaTable = await prisma.reportTable.findUnique({ where: { slug: "chart-of-accounts" }, include: { rows: true } });
  const coa = (coaTable?.rows || [])
    .map((r) => ({
      number: String(r.label || r.rowKey || "").trim(),
      name: String((r.data as any)?.account || "").trim(),
      type: String((r.data as any)?.type || "").trim(),
    }))
    .filter((c) => c.number && c.name);

  const shaped = items.map((it) => {
    const rt: any = it.rawTransaction;
    const rawData: any = rt.rawData || {};
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
        suggestedCoaNumber: rawData.suggestedCoaNumber || null,
        suggestedCoaName: rawData.suggestedCoaName || null,
        codedCoaNumber: rawData.codedCoaNumber || null,
      },
    } as const;
  });

  return (
    <>
      <BookkeepingInboxClient />
      <ReviewQueueClient items={shaped as any} coa={coa as any} />
    </>
  );
}
