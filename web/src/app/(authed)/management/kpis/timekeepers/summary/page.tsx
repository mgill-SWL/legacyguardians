import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TimekeepersSummaryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const table = await prisma.reportTable.findUnique({ where: { slug: "timekeeper-kpis" }, include: { rows: true } });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Timekeepers Summary</h1>
        <a className="sw-btn" href="/management/kpis/timekeepers/reporting">
          Reporting →
        </a>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Summary view coming next. Rows currently: {table?.rows.length ?? 0}
      </p>
    </div>
  );
}
