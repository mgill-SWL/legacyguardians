import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { trustDeltaCents } from "@/lib/accounting/trust";

type Payload = {
  eventId?: string;
  matterId?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) {
    return NextResponse.json({ error: "Signed-in user has no active firm" }, { status: 400 });
  }

  const json = (await request.json().catch(() => null)) as Payload | null;
  const eventId = json?.eventId;
  const matterId = json?.matterId;

  if (!eventId || !matterId) {
    return NextResponse.json({ error: "eventId and matterId are required" }, { status: 400 });
  }

  const [event, matter] = await Promise.all([
    prisma.matterFinancialEvent.findFirst({
      where: { id: eventId, firmId: user.activeFirmId },
      select: { id: true, matterId: true, eventType: true, amountCents: true, fromAccountId: true, toAccountId: true },
    }),
    prisma.matter.findFirst({ where: { id: matterId, firmId: user.activeFirmId } }),
  ]);

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  if (event.matterId) {
    return NextResponse.json({ error: "Event is already linked to a matter" }, { status: 400 });
  }

  // Enforce no-negative-balance even during linking/cleanup.
  const existing = await prisma.matterFinancialEvent.findMany({
    where: {
      firmId: user.activeFirmId,
      matterId: matter.id,
      OR: [{ eventType: "TRUST_DEPOSIT" }, { eventType: "TRUST_APPLIED" }, { eventType: "TRANSFER" }, { eventType: "REFUND" }],
    },
    select: { eventType: true, amountCents: true, fromAccountId: true, toAccountId: true },
  });

  const accountIds = Array.from(
    new Set(
      [...existing, event]
        .flatMap((e) => [e.fromAccountId, e.toAccountId])
        .filter((v): v is string => !!v)
    )
  );
  const accounts = accountIds.length
    ? await prisma.billingAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, accountType: true } })
    : [];
  const accountTypeById = accounts.reduce<Record<string, any>>((acc, a) => {
    acc[a.id] = a.accountType;
    return acc;
  }, {});

  const currentBalanceCents = existing.reduce((sum, e) => {
    return (
      sum +
      trustDeltaCents({
        eventType: e.eventType,
        amountCents: e.amountCents,
        fromAccountType: e.fromAccountId ? accountTypeById[e.fromAccountId] : null,
        toAccountType: e.toAccountId ? accountTypeById[e.toAccountId] : null,
      })
    );
  }, 0);

  const delta = trustDeltaCents({
    eventType: event.eventType,
    amountCents: event.amountCents,
    fromAccountType: event.fromAccountId ? accountTypeById[event.fromAccountId] : null,
    toAccountType: event.toAccountId ? accountTypeById[event.toAccountId] : null,
  });

  if (currentBalanceCents + delta < 0) {
    return NextResponse.json(
      {
        error: `Blocked: linking would make trust balance negative (current ${(currentBalanceCents / 100).toFixed(2)}, delta ${(delta / 100).toFixed(2)}).`,
      },
      { status: 400 }
    );
  }

  await prisma.matterFinancialEvent.update({
    where: { id: event.id },
    data: { matterId: matter.id },
  });

  return NextResponse.json({ ok: true });
}
