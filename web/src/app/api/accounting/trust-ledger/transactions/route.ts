import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { trustDeltaCents } from "@/lib/accounting/trust";

type EventType = "TRUST_DEPOSIT" | "TRUST_APPLIED" | "TRANSFER" | "REFUND";

type Payload = {
  matterId?: string;
  eventType?: EventType;
  eventDate?: string; // YYYY-MM-DD
  amountUsd?: string;
  memo?: string;
};

function parseAmountCents(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) {
    return NextResponse.json({ error: "Signed-in user has no active firm" }, { status: 400 });
  }

  const json = (await request.json().catch(() => null)) as Payload | null;
  const matterId = json?.matterId;
  const eventType = json?.eventType;
  const eventDate = json?.eventDate;
  const amountUsd = json?.amountUsd;
  const memo = json?.memo || "";

  if (!matterId || !eventType || !eventDate || !amountUsd) {
    return NextResponse.json({ error: "matterId, eventType, eventDate, amountUsd are required" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return NextResponse.json({ error: "eventDate must be YYYY-MM-DD" }, { status: 400 });
  }

  if (!(["TRUST_DEPOSIT", "TRUST_APPLIED", "TRANSFER", "REFUND"] as const).includes(eventType)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  const amountCents = parseAmountCents(amountUsd);
  if (!amountCents) return NextResponse.json({ error: "Invalid amountUsd" }, { status: 400 });

  const matter = await prisma.matter.findFirst({ where: { id: matterId, firmId: user.activeFirmId } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  // Serializable transaction so concurrent writes cannot both pass the
  // negative-balance check and drive a client sub-ledger below zero.
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
          new Set(existing.flatMap((e) => [e.fromAccountId, e.toAccountId]).filter((v): v is string => !!v))
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

        // For the new entry, we know the intent: TRUST_DEPOSIT increases trust; all other types decrease.
        const intendedDeltaCents = trustDeltaCents({
          eventType,
          amountCents,
          toAccountType: eventType === "TRUST_DEPOSIT" ? "TRUST" : null,
          fromAccountType: eventType === "TRUST_DEPOSIT" ? null : "TRUST",
        });

        const nextBalanceCents = currentBalanceCents + intendedDeltaCents;
        if (nextBalanceCents < 0) {
          blockedError = `Blocked: would make trust balance negative (current ${(currentBalanceCents / 100).toFixed(2)}, delta ${(
            intendedDeltaCents / 100
          ).toFixed(2)}).`;
          return;
        }

        const trustAccount = await tx.billingAccount.upsert({
          where: { firmId_name: { firmId: user.activeFirmId!, name: "Trust" } },
          update: { accountType: "TRUST", active: true },
          create: {
            firmId: user.activeFirmId!,
            name: "Trust",
            accountType: "TRUST",
            sourceSystem: "MANUAL",
            active: true,
          },
        });
        const operatingAccount = await tx.billingAccount.upsert({
          where: { firmId_name: { firmId: user.activeFirmId!, name: "Operating" } },
          update: { accountType: "OPERATING", active: true },
          create: {
            firmId: user.activeFirmId!,
            name: "Operating",
            accountType: "OPERATING",
            sourceSystem: "MANUAL",
            active: true,
          },
        });

        const fromAccountId = eventType === "TRUST_DEPOSIT" ? null : trustAccount.id;
        const toAccountId = eventType === "TRUST_DEPOSIT" ? trustAccount.id : eventType === "TRANSFER" ? operatingAccount.id : null;

        await tx.matterFinancialEvent.create({
          data: {
            firmId: user.activeFirmId!,
            matterId: matter.id,
            createdByUserId: user.id,
            eventType,
            eventDate: new Date(`${eventDate}T00:00:00.000Z`),
            amountCents,
            currency: "USD",
            sourceSystem: "MANUAL",
            sourceReference: "manual_trust_ledger",
            notes: memo || null,
            fromAccountId,
            toAccountId,
          },
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
