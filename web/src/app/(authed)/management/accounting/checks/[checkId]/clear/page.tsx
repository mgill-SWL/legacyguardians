import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ClearCheckClient } from "./ui";

export const dynamic = "force-dynamic";

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

function shortDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function extractCheckNumber(rawData: unknown): string | null {
  const rd = (rawData as Record<string, unknown>) || {};
  const cn = rd["checkNumber"];
  return typeof cn === "string" && cn.trim() ? cn.trim() : null;
}

export default async function ClearOperatingCheckPage({ params }: { params: Promise<{ checkId: string }> }) {
  const { checkId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const check = await prisma.operatingCheck.findUnique({
    where: { id: checkId },
    include: { financialAccount: true, clearedRawTransaction: true },
  });

  if (!check || check.firmId !== user.activeFirmId) redirect("/management/accounting/checks");
  if (check.status === "VOID") redirect("/management/accounting/checks");
  if (check.clearedRawTransactionId) redirect("/management/accounting/checks");

  const recent = await prisma.rawFinancialTransaction.findMany({
    where: {
      firmId: user.activeFirmId,
      accountId: check.financialAccountId,
      direction: "OUTFLOW",
      amountCents: check.amountCents,
    },
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    take: 250,
  });

  const candidates = recent
    .map((t) => {
      const cn = extractCheckNumber(t.rawData);
      if (!cn) return null;
      // Most banks store check numbers as digits; we match exact string.
      if (cn !== check.checkNumber) return null;
      return {
        id: t.id,
        transactionDate: shortDate(t.transactionDate),
        amountCents: t.amountCents,
        description: t.description,
        payee: t.payee,
        checkNumber: cn,
      };
    })
    .filter(Boolean) as Array<{ id: string; transactionDate: string; amountCents: number; description: string; payee: string | null; checkNumber: string }>;

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            Clear check
          </h1>
          <div className="sw-muted">
            {check.financialAccount?.name ?? "(account)"} · #{check.checkNumber} · {usd(check.amountCents)} · {check.payeeName}
          </div>
        </div>
        <Link className="sw-btn" href="/management/accounting/checks">
          ← Back
        </Link>
      </div>

      <ClearCheckClient checkId={check.id} candidates={candidates} />
    </div>
  );
}

