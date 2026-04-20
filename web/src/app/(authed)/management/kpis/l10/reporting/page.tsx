import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";

export const dynamic = "force-dynamic";

const SLUG = "exec-team-kpis";

const DEFAULT_COLUMNS = [
  { key: "month", label: "Month", type: "TEXT" },
  { key: "ep_new_onboarded", label: "# EP new onboarded", type: "NUMBER" },
  { key: "other_cases_onboarded", label: "# Other cases onboarded", type: "NUMBER" },
  { key: "total_onboarded", label: "Total", type: "NUMBER" },
  { key: "ep_pre_design", label: "EP Cases Pre-Design Meeting", type: "NUMBER" },
  { key: "ep_pre_doc_tour", label: "EP Cases Pre-Doc Tour", type: "NUMBER" },
  { key: "ep_concluded", label: "EP Cases Concluded", type: "NUMBER" },
  { key: "monthly_collections", label: "Monthly Collections", type: "CURRENCY" },
  { key: "ep_case_revenue", label: "EP Case Revenue", type: "CURRENCY" },
  { key: "other_case_revenue", label: "Other case revenue", type: "CURRENCY" },
  { key: "avg_ep_case_value", label: "Average EP Case Value", type: "CURRENCY" },
  { key: "avg_other_case_value", label: "Average Other Case Value", type: "CURRENCY" },
  { key: "lawpay_trailing_30_volume", label: "Lawpay trailing 30 day volume", type: "CURRENCY" },
  { key: "lawpay_past_30_avg_tx", label: "Lawpay past 30 days avg trx value", type: "CURRENCY" },
] as const;

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
        <h1 className="sw-h1">L10 Reporting</h1>
        <a className="sw-btn" href="/management/kpis/l10/summary">
          Summary →
        </a>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>Executive-level reporting (admin-only for now).</p>
      <ReportGrid table={ensured as any} canAdmin={true} />
    </div>
  );
}
