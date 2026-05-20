import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { PrintCheckClient } from "./ui";

export const dynamic = "force-dynamic";

function canBookkeep({ userRole, memberKind, memberRole }: { userRole: string; memberKind?: string; memberRole?: string }) {
  if (userRole === "ADMIN") return true;
  if (memberRole === "ADMIN") return true;
  if (memberKind === "BOOKKEEPER" || memberKind === "ADMIN") return true;
  return false;
}

export default async function PrintOperatingCheckPage({ params }: { params: Promise<{ checkId: string }> }) {
  const { checkId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  if (!canBookkeep({ userRole: user.role, memberKind: member?.kind, memberRole: member?.role })) redirect("/unauthorized");

  const check = await prisma.operatingCheck.findUnique({
    where: { id: checkId },
    include: { financialAccount: true },
  });
  if (!check || check.firmId !== user.activeFirmId) redirect("/management/accounting/checks");

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1" style={{ marginBottom: 6 }}>
            Print check
          </h1>
          <div className="sw-muted">
            {check.financialAccount?.name ?? "(account)"} · #{check.checkNumber} · {check.payeeName}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="sw-btn" href="/management/accounting/checks">
            ← Back
          </Link>
        </div>
      </div>

      <PrintCheckClient checkId={check.id} payload={{
        checkNumber: check.checkNumber || null,
        issueDate: check.issueDate.toISOString().slice(0, 10),
        payeeName: check.payeeName,
        amountCents: check.amountCents,
        memo: check.memo || "",
        accountName: check.financialAccount?.name || "",
      }} />
    </div>
  );
}
