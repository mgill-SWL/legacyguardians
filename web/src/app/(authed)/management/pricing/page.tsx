import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { PricingClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canEdit = user?.role === "ADMIN";

  const firmId = user?.activeFirmId || undefined;

  const features = await prisma.feeFeature.findMany({
    where: firmId ? { firmId } : undefined,
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Pricing</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        App-editable price/feature catalog used by the fee quote engine.
      </p>

      <PricingClient initialFeatures={features} canEdit={!!canEdit} />
    </div>
  );
}
