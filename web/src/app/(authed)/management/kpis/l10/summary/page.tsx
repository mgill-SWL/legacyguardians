import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function L10SummaryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== "ADMIN") redirect("/management/kpis");

  const table = await prisma.reportTable.findUnique({ where: { slug: "exec-team-kpis" }, include: { rows: true } });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">L10 Summary</h1>
        <a className="sw-btn" href="/management/kpis/l10/reporting">
          Reporting →
        </a>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Summary view coming next. Rows currently: {table?.rows.length ?? 0}
      </p>
    </div>
  );
}
