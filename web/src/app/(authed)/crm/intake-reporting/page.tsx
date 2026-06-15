import type { ReportColumnType } from "@prisma/client";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";
import { SyncFromSheetButton } from "./SyncFromSheetButton";

export const dynamic = "force-dynamic";

const SLUG = "intake-reporting";

const DEFAULT_COLUMNS: { key: string; label: string; type?: ReportColumnType }[] = [
  { key: "scheduled_intake", label: "Scheduled Intake", type: "NUMBER" },
  { key: "live_transfer", label: "Live Transfer (Lex)", type: "NUMBER" },
  { key: "ringcentral_calls", label: "RingCentral Incoming Calls", type: "NUMBER" },
  { key: "intake_no_shows", label: "Intake Call No Shows", type: "NUMBER" },
  { key: "total_intake_calls", label: "Total Intake Calls", type: "NUMBER" },
  { key: "qualified", label: "Qualified", type: "NUMBER" },
  { key: "strategy_meeting_500_booked", label: "$500 Strategy Meeting Booked", type: "NUMBER" },
  { key: "welcome_calls_booked", label: "Welcome Calls Booked", type: "NUMBER" },
  { key: "welcome_calls_held", label: "Welcome Calls Held", type: "NUMBER" },
  { key: "paid_consult_500_held", label: "$500 Paid Consult Held", type: "NUMBER" },
  { key: "design_meetings_booked", label: "Design Meetings Booked", type: "NUMBER" },
  { key: "design_meetings_held", label: "Design Meetings Held", type: "NUMBER" },
  { key: "design_meetings_cancelled", label: "Design Meetings Cancelled", type: "NUMBER" },
  { key: "close_ea_matters", label: "Closed EA Matters", type: "NUMBER" },
  { key: "doc_tour_held", label: "Document Tours Held", type: "NUMBER" },
  { key: "signing_held", label: "Signing Held", type: "NUMBER" },
  { key: "reviews_5_star", label: "5-star Reviews", type: "NUMBER" },
  { key: "pct_qualified", label: "% Qualified", type: "PERCENT" },
  { key: "total_conversion", label: "Total Conversion", type: "PERCENT" },
];

async function ensureColumns(tableId: string) {
  const existing = await prisma.reportColumn.findMany({ where: { tableId } });
  const byKey = new Map(existing.map((c) => [c.key, c] as const));
  const max = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  let next = max + 1;

  for (const c of DEFAULT_COLUMNS) {
    const found = byKey.get(c.key);
    if (!found) {
      await prisma.reportColumn.create({
        data: {
          tableId,
          key: c.key,
          label: c.label,
          type: c.type || "TEXT",
          sortOrder: next++,
        },
      });
      continue;
    }

    // Keep labels/types in sync with our defaults (for renamed/retagged columns).
    const desiredType: ReportColumnType = c.type || "TEXT";
    if (found.label !== c.label || found.type !== desiredType) {
      await prisma.reportColumn.update({
        where: { id: found.id },
        data: { label: c.label, type: desiredType },
      });
    }
  }
}

export default async function IntakeReportingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canAdmin = user?.role === "ADMIN";

  const table = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: {
      columns: { orderBy: { sortOrder: "asc" } },
      rows: { orderBy: { sortOrder: "asc" } },
    },
  });

  const ensured = table
    ? table
    : await prisma.reportTable.create({
        data: {
          slug: SLUG,
          name: "Intake Reporting",
          columns: {
            create: DEFAULT_COLUMNS.map((c, idx) => ({
              key: c.key,
              label: c.label,
              type: c.type || "TEXT",
              sortOrder: idx,
            })),
          },
          rows: {
            create: [],
          },
        },
        include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
      });

  // If we already created the table earlier with fewer columns, backfill missing defaults.
  if (table) {
    await ensureColumns(table.id);
  }

  const refreshed = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: {
      columns: { orderBy: { sortOrder: "asc" } },
      rows: { orderBy: { sortOrder: "asc" } },
    },
  });

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Intake Reporting</h1>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          {process.env.LG_INTAKE_KPI_SPREADSHEET_ID ? "Google Sheet sync" : "Manual entry"}
        </div>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        {process.env.LG_INTAKE_KPI_SPREADSHEET_ID
          ? "This table can be synced from the Intake KPI Google Sheet. You can still add extra manual columns as needed."
          : "Manual entry table. (We can enable Google Sheet sync by setting LG_INTAKE_KPI_SPREADSHEET_ID.)"}
      </p>

      {process.env.LG_INTAKE_KPI_SPREADSHEET_ID && canAdmin ? (
        <div style={{ marginTop: 10 }}>
          <SyncFromSheetButton />
        </div>
      ) : null}

      <ReportGrid table={refreshed || ensured} canAdmin={!!canAdmin} />
    </div>
  );
}
