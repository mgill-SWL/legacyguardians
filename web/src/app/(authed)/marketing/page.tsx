import Link from "next/link";

import { prisma } from "@/lib/prisma";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  INBOUND_TEXT: "Inbound text",
  INBOUND_CALL: "Inbound call",
  FORM_FILL: "Form fill",
  WEBINAR: "Webinar",
  REGISTRATION: "Registration",
  IMPORT: "Import",
};

function usd(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pct(num: number, denom: number) {
  if (!denom) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}

type Funnel = { leads: number; proposal: number; raSent: number; signed: number; converted: number };

function emptyFunnel(): Funnel {
  return { leads: 0, proposal: 0, raSent: 0, signed: 0, converted: 0 };
}

export default async function MarketingOverviewPage() {
  const [registrations, leadRows, campaigns, regByCampaign, spendByCampaign] = await Promise.all([
    prisma.crmRegistration.count(),
    prisma.crmLeadPipeline.findMany({
      select: {
        campaignId: true,
        sourceType: true,
        proposalPreparedAt: true,
        raSentAt: true,
        raSignedAt: true,
        convertedAt: true,
      },
    }),
    prisma.crmCampaign.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.crmRegistration.groupBy({ by: ["campaignId"], _count: { _all: true } }),
    prisma.crmDailySpend.groupBy({ by: ["campaignId"], _sum: { amountCents: true } }),
  ]);

  const totalLeads = leadRows.length;
  const totalSigned = leadRows.filter((l) => l.raSignedAt).length;
  const totalConverted = leadRows.filter((l) => l.convertedAt).length;
  const totalSpendCents = spendByCampaign.reduce((sum, r) => sum + (r._sum.amountCents ?? 0), 0);
  const costPerLead = totalLeads ? totalSpendCents / totalLeads : 0;

  // By channel (lead sourceType)
  const byChannel = new Map<string, Funnel>();
  for (const l of leadRows) {
    const key = l.sourceType ?? "MANUAL";
    const f = byChannel.get(key) ?? emptyFunnel();
    f.leads += 1;
    if (l.proposalPreparedAt) f.proposal += 1;
    if (l.raSentAt) f.raSent += 1;
    if (l.raSignedAt) f.signed += 1;
    if (l.convertedAt) f.converted += 1;
    byChannel.set(key, f);
  }
  const channelRows = [...byChannel.entries()]
    .map(([source, f]) => ({ source, ...f }))
    .sort((a, b) => b.leads - a.leads);

  // By campaign
  const regCountByCampaign = new Map(regByCampaign.map((r) => [r.campaignId, r._count._all]));
  const spendCentsByCampaign = new Map(spendByCampaign.map((r) => [r.campaignId, r._sum.amountCents ?? 0]));
  const funnelByCampaign = new Map<string, Funnel>();
  for (const l of leadRows) {
    if (!l.campaignId) continue;
    const f = funnelByCampaign.get(l.campaignId) ?? emptyFunnel();
    f.leads += 1;
    if (l.proposalPreparedAt) f.proposal += 1;
    if (l.raSentAt) f.raSent += 1;
    if (l.raSignedAt) f.signed += 1;
    if (l.convertedAt) f.converted += 1;
    funnelByCampaign.set(l.campaignId, f);
  }
  const campaignRows = campaigns
    .map((cam) => {
      const f = funnelByCampaign.get(cam.id) ?? emptyFunnel();
      const regs = regCountByCampaign.get(cam.id) ?? 0;
      const spendCents = spendCentsByCampaign.get(cam.id) ?? 0;
      return { ...cam, regs, spendCents, ...f };
    })
    .filter((c) => c.regs || c.leads || c.spendCents)
    .sort((a, b) => b.leads - a.leads || b.regs - a.regs);

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <div>
          <div className={styles.eyebrow}>Marketing</div>
          <h1 className={styles.title}>Marketing overview</h1>
          <p className={styles.subcopy}>
            Channel and campaign performance from your live CRM data. Every number below is computed from
            existing registrations, lead pipeline records, and recorded ad spend.
          </p>
        </div>
        <Link className="sw-btn" href="/marketing/webinars">
          Webinars →
        </Link>
      </div>

      <section className={styles.statusStrip} aria-label="Marketing totals">
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Registrations</div>
          <div className={styles.metricValue}>{registrations}</div>
          <div className={styles.metricNote}>Total webinar/event registrations.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Leads</div>
          <div className={styles.metricValue}>{totalLeads}</div>
          <div className={styles.metricNote}>Lead pipeline records.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>RA signed</div>
          <div className={styles.metricValue}>{totalSigned}</div>
          <div className={styles.metricNote}>Leads with a signed representation agreement.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Converted</div>
          <div className={styles.metricValue}>{totalConverted}</div>
          <div className={styles.metricNote}>Leads converted to a client/matter.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Ad spend</div>
          <div className={styles.metricValue}>{usd(totalSpendCents)}</div>
          <div className={styles.metricNote}>Total recorded campaign spend.</div>
        </div>
        <div className={styles.statusCell}>
          <div className={styles.metricLabel}>Cost / lead</div>
          <div className={styles.metricValue}>{totalLeads ? usd(costPerLead) : "—"}</div>
          <div className={styles.metricNote}>Spend divided by leads.</div>
        </div>
      </section>

      <section className="sw-card sw-card-pad" style={{ marginTop: 16 }}>
        <h2 className={styles.sectionTitle}>By channel</h2>
        {channelRows.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th className="sw-th">Channel</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Leads</th>
                <th className="sw-th" style={{ textAlign: "right" }}>RA signed</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Converted</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Conv. rate</th>
              </tr>
            </thead>
            <tbody>
              {channelRows.map((r) => (
                <tr className="sw-tr" key={r.source}>
                  <td className="sw-td">{SOURCE_LABELS[r.source] ?? r.source}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{r.leads}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{r.signed}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{r.converted}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{pct(r.converted, r.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>No lead data yet.</div>
        )}
      </section>

      <section className="sw-card sw-card-pad" style={{ marginTop: 16 }}>
        <h2 className={styles.sectionTitle}>By campaign</h2>
        {campaignRows.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th className="sw-th">Campaign</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Regs</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Leads</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Proposal</th>
                <th className="sw-th" style={{ textAlign: "right" }}>RA sent</th>
                <th className="sw-th" style={{ textAlign: "right" }}>RA signed</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Converted</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Spend</th>
                <th className="sw-th" style={{ textAlign: "right" }}>Cost / lead</th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.map((c) => (
                <tr className="sw-tr" key={c.id}>
                  <td className="sw-td">{c.name || c.slug}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{c.regs}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{c.leads}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{c.proposal}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{c.raSent}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{c.signed}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{c.converted}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>{c.spendCents ? usd(c.spendCents) : "—"}</td>
                  <td className="sw-td" style={{ textAlign: "right" }}>
                    {c.spendCents && c.leads ? usd(c.spendCents / c.leads) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>No campaign activity yet.</div>
        )}
      </section>
    </div>
  );
}
