import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

import { UnmatchedTrustEventsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function UnmatchedTrustEventsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const firmId = user?.activeFirmId || undefined;
  if (!firmId) redirect("/management/accounting/trust-ledger");

  const matters = await prisma.matter.findMany({
    where: { firmId },
    select: { id: true, displayName: true },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const events = await prisma.matterFinancialEvent.findMany({
    where: {
      firmId,
      matterId: null,
      OR: [{ eventType: "TRUST_DEPOSIT" }, { eventType: "TRUST_APPLIED" }, { eventType: "TRANSFER" }, { eventType: "REFUND" }],
    },
    select: {
      id: true,
      eventDate: true,
      eventType: true,
      amountCents: true,
      sourceClientName: true,
      sourceMatterName: true,
      sourceInvoiceNumber: true,
      sourceReference: true,
      notes: true,
      importBatchId: true,
    },
    orderBy: [{ eventDate: "desc" }, { id: "desc" }],
    take: 400,
  });

  return (
    <UnmatchedTrustEventsClient
      matters={matters}
      events={events.map((e) => ({
        ...e,
        eventDate: e.eventDate.toISOString(),
      }))}
    />
  );
}

