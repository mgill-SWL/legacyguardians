import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export default async function IntakeKpiSummary() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const table = await prisma.reportTable.findUnique({
    where: { slug: "intake-reporting" },
    include: { rows: { orderBy: { sortOrder: "asc" } } },
  });

  const rows = table?.rows || [];
  const totals = rows.reduce(
    (acc, r) => {
      const d: any = r.data || {};
      acc.scheduled += n(d.scheduled_intake);
      acc.qualified += n(d.qualified);
      acc.welcomeHeld += n(d.welcome_calls_held);
      acc.designHeld += n(d.design_meetings_held);
      acc.signings += n(d.signing_held);
      return acc;
    },
    { scheduled: 0, qualified: 0, welcomeHeld: 0, designHeld: 0, signings: 0 }
  );

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Intake KPIs</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        Summary based on Intake Reporting entries.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>Scheduled intake</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.scheduled}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>Qualified</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.qualified}</div>
          <div className="sw-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {pct(totals.qualified, totals.scheduled)}% of scheduled
          </div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>Welcome calls held</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.welcomeHeld}</div>
          <div className="sw-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {pct(totals.welcomeHeld, totals.qualified)}% of qualified
          </div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>Design meetings held</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.designHeld}</div>
        </div>
        <div className="sw-card sw-card-pad">
          <div className="sw-muted" style={{ fontSize: 12 }}>Signings held</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>{totals.signings}</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <a className="sw-btn" href="/crm/intake-reporting">
          Edit Intake Reporting →
        </a>
      </div>
    </div>
  );
}
