import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";

export const dynamic = "force-dynamic";

const SLUG = "firm-scoreboard";

const DEFAULT_COLUMNS: { key: string; label: string; type: "CURRENCY" | "NUMBER" | "TEXT" }[] = [
  { key: "monthly_goal", label: "Monthly goal ($)", type: "CURRENCY" },
  { key: "lawpay_30d_volume", label: "LawPay 30-day volume ($)", type: "CURRENCY" },
  { key: "notes", label: "Notes", type: "TEXT" },
];

async function ensureColumns(tableId: string) {
  const existing = await prisma.reportColumn.findMany({ where: { tableId } });
  const byKey = new Set(existing.map((c) => c.key));
  const max = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  let next = max + 1;

  for (const c of DEFAULT_COLUMNS) {
    if (byKey.has(c.key)) continue;
    await prisma.reportColumn.create({
      data: {
        tableId,
        key: c.key,
        label: c.label,
        type: c.type,
        sortOrder: next++,
      },
    });
  }
}

export default async function ScoreboardReportingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  const canAdmin = user?.role === "ADMIN";
  if (!canAdmin) redirect("/unauthorized");

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
          name: "Firm scoreboard inputs",
          columns: {
            create: DEFAULT_COLUMNS.map((c, idx) => ({
              key: c.key,
              label: c.label,
              type: c.type,
              sortOrder: idx,
            })),
          },
          rows: { create: [] },
        },
        include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
      });

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
        <h1 className="sw-h1">Firm scoreboard (inputs)</h1>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Manual entry
        </div>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Enter the monthly goal and the LawPay 30-day volume number you want shown on the dashboard.
      </p>
      <ReportGrid table={(refreshed || ensured) as any} canAdmin={!!canAdmin} />
    </div>
  );
}

