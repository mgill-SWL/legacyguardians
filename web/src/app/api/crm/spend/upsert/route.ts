import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { dayKeyToNoonUTC } from "@/lib/timeBuckets";

export const dynamic = "force-dynamic";

type Body = {
  campaignId: string;
  dayKey: string; // YYYY-MM-DD (ET)
  amountDollars: number;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.campaignId || !body?.dayKey || typeof body.amountDollars !== "number") {
    return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dayKey)) {
    return NextResponse.json({ ok: false, error: "Invalid dayKey" }, { status: 400 });
  }

  const amountCents = Math.round(body.amountDollars * 100);
  if (amountCents < 0 || amountCents > 10_000_000_00) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  }

  const day = dayKeyToNoonUTC(body.dayKey);

  await prisma.crmDailySpend.upsert({
    where: { campaignId_day: { campaignId: body.campaignId, day } },
    update: { amountCents },
    create: { campaignId: body.campaignId, day, amountCents },
  });

  return NextResponse.json({ ok: true });
}
