import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { WithdrawalClient } from "./ui";

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

export default async function AddWithdrawalPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const account = await prisma.financialAccount.findFirst({ where: { id: accountId, firmId: user.activeFirmId, active: true } });
  if (!account) redirect("/management/accounting/banks");

  const seq = await prisma.financialAccountCheckSequence.findUnique({ where: { financialAccountId: account.id } });

  // Fallback: find max numeric check # from checks + imported txns.
  let proposed = seq?.nextNumber ? String(seq.nextNumber) : "";
  if (!proposed) {
    const [maxCheck, maxRaw] = await Promise.all([
      prisma.operatingCheck.findMany({
        where: { firmId: user.activeFirmId, financialAccountId: account.id },
        select: { checkNumber: true },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
      prisma.rawFinancialTransaction.findMany({
        where: { firmId: user.activeFirmId, accountId: account.id },
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
    proposed = String(max > 0 ? max + 1 : 1001);
  }

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            Add withdrawal
          </h1>
          <div className="sw-muted">{account.name}</div>
        </div>
        <Link className="sw-btn" href={`/management/accounting/banks/${account.id}`}>
          ← Back
        </Link>
      </div>

      <WithdrawalClient financialAccountId={account.id} accountName={account.name} proposedCheckNumber={proposed} />
    </div>
  );
}

