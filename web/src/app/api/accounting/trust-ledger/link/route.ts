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

  // Enforce no-negative-balance even during linking/cleanup. Serializable
  // transaction so a concurrent write cannot race past the balance check.
  let blockedError: string | null = null;
  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.matterFinancialEvent.findMany({
          where: {
            firmId: user.activeFirmId!,
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
          ? await tx.billingAccount.findMany({ where: { id: { in: accountIds } }, select: { id: true, accountType: true } })
          : [];
        const accountTypeById = accounts.reduce<Record<string, (typeof accounts)[number]["accountType"]>>((acc, a) => {
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
          blockedError = `Blocked: linking would make trust balance negative (current ${(currentBalanceCents / 100).toFixed(2)}, delta ${(delta / 100).toFixed(2)}).`;
          return;
        }

        await tx.matterFinancialEvent.update({
          where: { id: event.id },
          data: { matterId: matter.id },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (e) {
    if ((e as { code?: string })?.code === "P2034") {
      return NextResponse.json(
        { error: "Another trust ledger update was in progress. Please retry." },
        { status: 409 }
      );
    }
    throw e;
  }

  if (blockedError) {
    return NextResponse.json({ error: blockedError }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
