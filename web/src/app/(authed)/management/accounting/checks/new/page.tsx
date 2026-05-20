import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { NewCheckClient } from "./ui";

export const dynamic = "force-dynamic";

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

function isDigits(s: string) {
  return /^[0-9]+$/.test(s);
}

type Account = { id: string; name: string; kind: string };

export default async function NewOperatingCheckPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const accounts: Account[] = await prisma.financialAccount.findMany({
    where: { firmId: user.activeFirmId, active: true, kind: { in: ["OPERATING_BANK", "MONEY_MARKET", "TRUST_BANK", "OTHER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, kind: true },
  });

  // Pick a default account (first alphabetically).
  const defaultAccountId = accounts[0]?.id ?? null;

  // Best-effort proposed next check number (per account):
  // 1) sequence.nextNumber if present
  // 2) max(existing checks checkNumber numeric) + 1
  // 3) max(imported raw txns rawData.checkNumber numeric) + 1
  // 4) fallback 1001
  const proposedByAccountId: Record<string, string> = {};
  for (const a of accounts) {
    const seq = await prisma.financialAccountCheckSequence.findUnique({ where: { financialAccountId: a.id } });
    if (seq?.nextNumber) {
      proposedByAccountId[a.id] = String(seq.nextNumber);
      continue;
    }

    const [maxCheck, maxRaw] = await Promise.all([
      prisma.operatingCheck.findMany({
        where: { firmId: user.activeFirmId, financialAccountId: a.id },
        select: { checkNumber: true },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
      prisma.rawFinancialTransaction.findMany({
        where: { firmId: user.activeFirmId, accountId: a.id },
        select: { rawData: true },
        orderBy: { transactionDate: "desc" },
        take: 500,
      }),
    ]);

    let max = 0;
    for (const c of maxCheck) {
      const n = String(c.checkNumber || "").trim();
      if (!isDigits(n)) continue;
      max = Math.max(max, Number(n));
    }
    for (const t of maxRaw) {
      const rd = (t.rawData as Record<string, unknown>) || {};
      const rawCn = typeof rd["checkNumber"] === "string" ? (rd["checkNumber"] as string) : "";
      const n = String(rawCn || "").trim();
      if (!isDigits(n)) continue;
      max = Math.max(max, Number(n));
    }

    proposedByAccountId[a.id] = String(max > 0 ? max + 1 : 1001);
  }

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            New check
          </h1>
          <div className="sw-muted">Auto-proposes the next check number per bank account; you can override before issuing.</div>
        </div>
        <Link className="sw-btn" href="/management/accounting/checks">
          ← Back
        </Link>
      </div>

      <NewCheckClient accounts={accounts} defaultAccountId={defaultAccountId} proposedByAccountId={proposedByAccountId} />
    </div>
  );
}
