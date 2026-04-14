import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { etDayKey } from "@/lib/timeBuckets";
import { SpendForm } from "./SpendForm";

export const dynamic = "force-dynamic";

export default async function SpendPage() {
  const campaigns = await prisma.crmCampaign.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, name: true },
  });

  const recent = await prisma.crmDailySpend.findMany({
    orderBy: [{ day: "desc" }],
    take: 50,
    include: { campaign: true },
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Spend</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Manual ad spend entry (MVP). Used by the weekly report.
      </p>

      <div style={{ marginTop: 16 }}>
        <SpendForm campaigns={campaigns} />
      </div>

      <div style={{ marginTop: 18, color: "var(--sw-muted, #aab4d4)" }}>
        <Link href="/crm/reports/weekly">Go to Weekly report</Link>
      </div>

      <div style={{ marginTop: 18, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--sw-border, rgba(255,255,255,0.12))" }}>
              <th style={{ padding: "10px 8px" }}>Day (ET)</th>
              <th style={{ padding: "10px 8px" }}>Campaign</th>
              <th style={{ padding: "10px 8px" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "10px 8px" }}>{etDayKey(r.day)}</td>
                <td style={{ padding: "10px 8px" }}>{r.campaign.slug}</td>
                <td style={{ padding: "10px 8px" }}>${(r.amountCents / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.length === 0 ? (
          <div style={{ marginTop: 12, color: "var(--sw-muted, #aab4d4)" }}>No spend entries yet.</div>
        ) : null}
      </div>
    </div>
  );
}
