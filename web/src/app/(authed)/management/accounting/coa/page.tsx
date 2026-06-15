import type { ReportColumnType } from "@prisma/client";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";
import { CoaImportClient } from "./ui";

export const dynamic = "force-dynamic";

const SLUG = "chart-of-accounts";

const DEFAULT_COLUMNS: { key: string; label: string; type: ReportColumnType }[] = [
  { key: "account", label: "Account", type: "TEXT" },
  { key: "type", label: "Type", type: "TEXT" },
  { key: "balance", label: "Balance", type: "CURRENCY" },
];

async function ensureColumns(tableId: string) {
  const existing = await prisma.reportColumn.findMany({ where: { tableId } });
  const byKey = new Set(existing.map((c) => c.key));
  const max = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  let next = max + 1;
  for (const c of DEFAULT_COLUMNS) {
    if (byKey.has(c.key)) continue;
    await prisma.reportColumn.create({ data: { tableId, key: c.key, label: c.label, type: c.type, sortOrder: next++ } });
  }
}

export default async function ChartOfAccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const member = await prisma.firmMember.findUnique({ where: { firmId_userId: { firmId: user.activeFirmId, userId: user.id } } });
  const canManage = user.role === "ADMIN" || member?.role === "ADMIN" || member?.kind === "BOOKKEEPER" || member?.kind === "ADMIN";
  if (!canManage) redirect("/unauthorized");

  const table = await prisma.reportTable.findUnique({
    where: { slug: SLUG },
    include: { columns: { orderBy: { sortOrder: "asc" } }, rows: { orderBy: { sortOrder: "asc" } } },
  });

  const ensured = table
    ? table
    : await prisma.reportTable.create({
        data: {
          slug: SLUG,
          firmId: user.activeFirmId,
          name: "Chart of Accounts",
          columns: { create: DEFAULT_COLUMNS.map((c, idx) => ({ key: c.key, label: c.label, type: c.type, sortOrder: idx })) },
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
        <h1 className="sw-h1">Chart of accounts</h1>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Admin
        </div>
      </div>
      <p className="sw-muted" style={{ marginTop: 8, maxWidth: 860 }}>
        This powers payee rules (auto-suggest COA codes on imported transactions).
      </p>

      <div style={{ marginTop: 12 }}>
        <CoaImportClient />
      </div>

      <ReportGrid table={refreshed || ensured} canAdmin={!!canManage} />
    </div>
  );
}
