import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { ReportGrid } from "@/components/reports/ReportGrid";

export const dynamic = "force-dynamic";

const SLUG = "payee-rules";

const DEFAULT_COLUMNS: { key: string; label: string; type: any }[] = [
  { key: "match_type", label: "Match", type: "TEXT" }, // CONTAINS | EXACT
  { key: "pattern", label: "Pattern", type: "TEXT" },
  { key: "applies_to", label: "Applies to", type: "TEXT" }, // CARD | OPERATING | IOLTA | ANY
  { key: "coa_number", label: "COA #", type: "TEXT" },
  { key: "classification", label: "Classification", type: "TEXT" }, // EXPENSE (for now)
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

export default async function PayeeRulesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user?.activeFirmId) redirect("/unauthorized");

  const canAdmin = user.role === "ADMIN";
  if (!canAdmin) redirect("/unauthorized");

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
          name: "Payee rules",
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
        <h1 className="sw-h1">Payee rules</h1>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Admin
        </div>
      </div>
      <p className="sw-muted" style={{ marginTop: 8, maxWidth: 920 }}>
        When we import transactions, we’ll use these rules to suggest a COA number (based on the transaction description/payee).
        Put the most specific rules first.
      </p>

      <div className="sw-card sw-card-pad" style={{ marginTop: 12, maxWidth: 920 }}>
        <div style={{ fontWeight: 900 }}>Examples</div>
        <div className="sw-muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
          <div>CONTAINS · GOOGLE *ADS · CARD · 6010 · EXPENSE</div>
          <div>CONTAINS · RINGCENTRAL · CARD · 6100 · EXPENSE</div>
        </div>
      </div>

      <ReportGrid table={(refreshed || ensured) as any} canAdmin={!!canAdmin} />
    </div>
  );
}

