import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";

export const dynamic = "force-dynamic";

const SLUG = "timekeeper-kpis";

const DEFAULT_COLUMNS = [
  { key: "month", label: "Month", type: "TEXT" },
  { key: "timekeeper", label: "Timekeeper", type: "TEXT" },
  { key: "new_matters_opened", label: "New matters opened", type: "NUMBER" },
  { key: "ep_matters_opened", label: "EP matters opened", type: "NUMBER" },
  { key: "fees_billed", label: "Fees billed", type: "CURRENCY" },
  { key: "fees_collected", label: "Fees collected", type: "CURRENCY" },
  { key: "five_star_reviews", label: "5 Star Reviews", type: "NUMBER" },
  { key: "welcome_calls_held", label: "Welcome Calls Held", type: "NUMBER" },
  { key: "design_meetings_booked", label: "Design Meetings Booked", type: "NUMBER" },
  { key: "welcome_call_conversion", label: "Welcome Call Conversion", type: "PERCENT" },
  { key: "avg_case_value", label: "Avg Case Value", type: "CURRENCY" },
] as const;

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
          columns: {
            create: DEFAULT_COLUMNS.map((c, idx) => ({ key: c.key, label: c.label, type: c.type as any, sortOrder: idx })),
          },
          rows: { create: [] },
        },
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
      <p className="sw-muted" style={{ marginTop: 8 }}>Manual entry table.</p>
      <ReportGrid table={ensured as any} canAdmin={!!canAdmin} />
    </div>
  );
}
