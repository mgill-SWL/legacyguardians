import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";
import { SyncReportSheetButton } from "@/components/reports/SyncReportSheetButton";
import { TIMEKEEPER_REPORT_COLUMNS, TIMEKEEPER_REPORT_SLUG } from "@/lib/kpis/reportTables";

export const dynamic = "force-dynamic";

const SLUG = TIMEKEEPER_REPORT_SLUG;
const DEFAULT_COLUMNS = TIMEKEEPER_REPORT_COLUMNS;

async function ensureColumns(tableId: string) {
  const existing = await prisma.reportColumn.findMany({ where: { tableId } });
  const byKey = new Set(existing.map((c) => c.key));
  const max = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  let next = max + 1;
  for (const c of DEFAULT_COLUMNS) {
    if (byKey.has(c.key)) continue;
    await prisma.reportColumn.create({
      data: { tableId, key: c.key, label: c.label, type: c.type, sortOrder: next++ },
    });
  }
}

export default async function TimekeepersReportingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canAdmin = user?.role === "ADMIN";

  const table = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
  });

  const ensured = table
    ? table
    : await prisma.reportTable.create({
        data: {
          slug: SLUG,
          name: "Timekeeper KPIs",
          columns: { create: DEFAULT_COLUMNS.map((c, idx) => ({ ...c, sortOrder: idx })) },
          rows: { create: [] },
        },
        include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
      });

  if (table) await ensureColumns(table.id);

  const refreshed = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Timekeepers Reporting</h1>
        <a className="sw-btn" href="/management/kpis/timekeepers/summary">
          Summary →
        </a>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        {process.env.LG_TIMEKEEPER_KPI_SPREADSHEET_ID
          ? "Timekeeper KPIs synced from Google Sheets. You can still add extra manual columns as needed."
          : "Manual entry table. (We can enable Google Sheet sync by setting LG_TIMEKEEPER_KPI_SPREADSHEET_ID.)"}
      </p>
      {process.env.LG_TIMEKEEPER_KPI_SPREADSHEET_ID && canAdmin ? (
        <div style={{ marginTop: 10 }}>
          <SyncReportSheetButton endpoint="/api/reports/timekeepers/sync" />
        </div>
      ) : null}
      <ReportGrid table={refreshed || ensured} canAdmin={!!canAdmin} />
    </div>
  );
}
