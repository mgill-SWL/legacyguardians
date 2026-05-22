import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";
import { SyncReportSheetButton } from "@/components/reports/SyncReportSheetButton";
import { L10_REPORT_COLUMNS, L10_REPORT_SLUG } from "@/lib/kpis/reportTables";

export const dynamic = "force-dynamic";

const SLUG = L10_REPORT_SLUG;
const DEFAULT_COLUMNS = L10_REPORT_COLUMNS;

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

export default async function L10ReportingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (user?.role !== "ADMIN") redirect("/management/kpis");

  const table = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
  });

  const ensured = table
    ? table
    : await prisma.reportTable.create({
        data: {
          slug: SLUG,
          name: "L10 Reporting",
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
        <h1 className="sw-h1">L10 Reporting</h1>
        <a className="sw-btn" href="/management/kpis/l10/summary">
          Summary →
        </a>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        {process.env.LG_L10_KPI_SPREADSHEET_ID
          ? "Executive-level reporting synced from Google Sheets. You can still add extra manual columns as needed."
          : "Executive-level reporting (admin-only for now)."}
      </p>
      {process.env.LG_L10_KPI_SPREADSHEET_ID ? (
        <div style={{ marginTop: 10 }}>
          <SyncReportSheetButton endpoint="/api/reports/l10/sync" />
        </div>
      ) : null}
      <ReportGrid table={refreshed || ensured} canAdmin={true} />
    </div>
  );
}
