import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default async function WeeklyReportPage() {
  const today = dayStart(new Date());
  const start = addDays(today, -6);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(start, i));

  // Pull spend entries and prequal submissions in range.
  const spend = await prisma.crmDailySpend.findMany({
    where: {
      day: { gte: start, lte: addDays(today, 1) },
    },
  });

  const prequals = await prisma.crmPrequalSubmission.findMany({
    where: {
      createdAt: { gte: start, lt: addDays(today, 1) },
    },
    select: { createdAt: true, qualified: true },
  });

  const spendByDay = new Map<string, number>();
  for (const s of spend) {
    const key = dayStart(s.day).toISOString().slice(0, 10);
    spendByDay.set(key, (spendByDay.get(key) || 0) + s.amountCents);
  }

  const leadsByDay = new Map<string, { leads: number; qualified: number; unqualified: number }>();
  for (const p of prequals) {
    const key = dayStart(p.createdAt).toISOString().slice(0, 10);
    const cur = leadsByDay.get(key) || { leads: 0, qualified: 0, unqualified: 0 };
    cur.leads += 1;
    if (p.qualified) cur.qualified += 1;
    else cur.unqualified += 1;
    leadsByDay.set(key, cur);
  }

  let totalSpend = 0;
  let totalLeads = 0;
  let totalQualified = 0;
  let totalUnqualified = 0;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Weekly Report (MVP)</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Manual spend entry + prequal submissions. (Day boundaries currently use server local midnight; we’ll switch to ET explicitly.)
      </p>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--sw-border, rgba(255,255,255,0.12))" }}>
              <th style={{ padding: "10px 8px" }}>Day</th>
              <th style={{ padding: "10px 8px" }}>Amount Spent</th>
              <th style={{ padding: "10px 8px" }}>Leads</th>
              <th style={{ padding: "10px 8px" }}>Qualified</th>
              <th style={{ padding: "10px 8px" }}>Unqualified</th>
              <th style={{ padding: "10px 8px" }}>Cost/Lead</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const cents = spendByDay.get(key) || 0;
              const row = leadsByDay.get(key) || { leads: 0, qualified: 0, unqualified: 0 };
              const cpl = row.leads ? cents / row.leads : 0;

              totalSpend += cents;
              totalLeads += row.leads;
              totalQualified += row.qualified;
              totalUnqualified += row.unqualified;

              return (
                <tr key={key} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <td style={{ padding: "10px 8px" }}>{key}</td>
                  <td style={{ padding: "10px 8px" }}>${(cents / 100).toFixed(2)}</td>
                  <td style={{ padding: "10px 8px" }}>{row.leads}</td>
                  <td style={{ padding: "10px 8px" }}>{row.qualified}</td>
                  <td style={{ padding: "10px 8px" }}>{row.unqualified}</td>
                  <td style={{ padding: "10px 8px" }}>${(cpl / 100).toFixed(2)}</td>
                </tr>
              );
            })}

            <tr style={{ borderTop: "1px solid var(--sw-border, rgba(255,255,255,0.2))" }}>
              <td style={{ padding: "10px 8px", fontWeight: 900 }}>Total</td>
              <td style={{ padding: "10px 8px", fontWeight: 900 }}>${(totalSpend / 100).toFixed(2)}</td>
              <td style={{ padding: "10px 8px", fontWeight: 900 }}>{totalLeads}</td>
              <td style={{ padding: "10px 8px", fontWeight: 900 }}>{totalQualified}</td>
              <td style={{ padding: "10px 8px", fontWeight: 900 }}>{totalUnqualified}</td>
              <td style={{ padding: "10px 8px", fontWeight: 900 }}>
                ${totalLeads ? ((totalSpend / totalLeads) / 100).toFixed(2) : "0.00"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
