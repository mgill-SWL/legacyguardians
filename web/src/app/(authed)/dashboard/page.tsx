import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./ui";
import { getDefaultGoogleEmailForUser, getIntakeKpisFromSheet } from "@/lib/kpis/intakeSheet";

export const dynamic = "force-dynamic";

type Kpi = { id: string; label: string; value: string; sub?: string };
type StageStat = { stageName: string; matterCount: number; totalValueCents: number };

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

async function getStageStats(pipelineName: string, firmId?: string): Promise<StageStat[]> {
  const anyPrisma = prisma as any;
  if (!anyPrisma.pipeline || !anyPrisma.matterPipeline) return [];

  const pipeline = await anyPrisma.pipeline.findFirst({
    where: { name: pipelineName },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!pipeline) return [];

  const links = await anyPrisma.matterPipeline.findMany({
    where: {
      pipelineId: pipeline.id,
      ...(firmId ? { matter: { firmId } } : {}),
    },
    include: {
      stage: true,
      matter: { select: { estimatedValueCents: true } },
    },
  });

  const byStage = new Map<string, StageStat>();
  for (const l of links) {
    const name = l.stage?.name || "(Unknown)";
    const prev = byStage.get(name) || { stageName: name, matterCount: 0, totalValueCents: 0 };
    prev.matterCount += 1;
    prev.totalValueCents += Number(l.matter?.estimatedValueCents || 0);
    byStage.set(name, prev);
  }

  const order = new Map<string, number>((pipeline.stages || []).map((s: any, idx: number) => [s.name, s.sortOrder ?? idx] as const));
  return Array.from(byStage.values()).sort((a, b) => (order.get(a.stageName) ?? 9999) - (order.get(b.stageName) ?? 9999));
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const anyPrisma = prisma as any;
  const user = anyPrisma.user ? await anyPrisma.user.findUnique({ where: { email: session.user.email } }) : null;
  const firmId: string | undefined = user?.activeFirmId || undefined;

  // --- Billing series (last 6 months) + MTD totals ---
  const now = new Date();
  const months: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = startOfMonth(d);
    const end = startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    months.push({
      key: monthKey(d),
      label: d.toLocaleString(undefined, { month: "short" }),
      start,
      end,
    });
  }

  const rangeStart = months[0]?.start || startOfMonth(now);
  const rangeEnd = startOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1));

  const events: { eventType: string; eventDate: Date; amountCents: number }[] = anyPrisma.matterFinancialEvent
    ? await anyPrisma.matterFinancialEvent.findMany({
        where: {
          ...(firmId ? { firmId } : {}),
          eventType: { in: ["BILLED", "PAYMENT_RECEIVED"] },
          eventDate: { gte: rangeStart, lt: rangeEnd },
        },
        select: { eventType: true, eventDate: true, amountCents: true },
      })
    : [];

  const byMonth = new Map<string, { billed: number; collected: number }>();
  for (const m of months) byMonth.set(m.key, { billed: 0, collected: 0 });

  for (const e of events) {
    const key = monthKey(new Date(e.eventDate));
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    if (e.eventType === "BILLED") bucket.billed += Number(e.amountCents || 0);
    if (e.eventType === "PAYMENT_RECEIVED") bucket.collected += Number(e.amountCents || 0);
  }

  const thisMonthKey = monthKey(now);
  const mtd = byMonth.get(thisMonthKey) || { billed: 0, collected: 0 };

  const billing = {
    series: months.map((m) => {
      const v = byMonth.get(m.key) || { billed: 0, collected: 0 };
      return { key: m.key, label: m.label, billedCents: v.billed, collectedCents: v.collected };
    }),
    billedMtdCents: mtd.billed,
    collectedMtdCents: mtd.collected,
  };

  // --- Scoreboard inputs ---
  const scoreboardRow: any = anyPrisma.reportTable
    ? await anyPrisma.reportTable.findUnique({ where: { slug: "firm-scoreboard" }, include: { rows: { orderBy: { sortOrder: "asc" } } } })
    : null;
  const scoreboardData = scoreboardRow?.rows?.[0]?.data || {};
  const monthlyGoalCents = Math.round(Number(scoreboardData.monthly_goal || 0) * 100);
  const lawpay30dCents = Math.round(Number(scoreboardData.lawpay_30d_volume || 0) * 100);

  const financialKpis: Kpi[] = [
    { id: "monthly_goal", label: "Monthly goal", value: usd(monthlyGoalCents) },
    { id: "billed_mtd", label: "Billed (MTD)", value: usd(billing.billedMtdCents) },
    { id: "collected_mtd", label: "Collected (MTD)", value: usd(billing.collectedMtdCents) },
    { id: "lawpay_30d", label: "LawPay 30-day volume", value: usd(lawpay30dCents) },
  ];

  // --- Intake KPIs (prefer Google Sheet; fallback to DB summary) ---
  const spreadsheetId = process.env.LG_INTAKE_KPI_SPREADSHEET_ID;

  let intakeKpis: Kpi[] = [];

  const fmt = (v: number) => (Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0");
  const fmtPct = (v: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0%";
    const asPct = n <= 1 ? n * 100 : n;
    return `${Math.round(asPct)}%`;
  };

  function isoWeekEndingFriday(d: Date) {
    // Week ending is Friday. If today is Friday, this returns today.
    const day = d.getDay(); // 0=Sun .. 5=Fri
    const delta = (5 - day + 7) % 7;
    const dd = d.getDate() + delta;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), dd)).toISOString().slice(0, 10);
  }

  function addDaysIso(iso: string, days: number) {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const da = Number(m[3]);
    return new Date(Date.UTC(y, mo, da + days)).toISOString().slice(0, 10);
  }

  function sumRows(
    rr: Array<{ totalIntakeCalls: number; designMeetingsHeld: number; designMeetingsCancelled: number }>
  ) {
    return rr.reduce(
      (acc, r) => {
        acc.calls += r.totalIntakeCalls;
        acc.held += r.designMeetingsHeld;
        acc.cancelled += r.designMeetingsCancelled;
        return acc;
      },
      { calls: 0, held: 0, cancelled: 0 }
    );
  }

  if (spreadsheetId) {
    const googleEmail = await getDefaultGoogleEmailForUser(session.user.email);
    if (googleEmail) {
      try {
        const year = new Date().getFullYear();
        const { rows } = await getIntakeKpisFromSheet({
          googleEmail,
          spreadsheetId,
          year,
          sheetNameTemplate: process.env.LG_INTAKE_KPI_SHEETNAME_TEMPLATE || "{YYYY} Intake KPIs",
        });

        const weekEndingThis = isoWeekEndingFriday(now);
        const weekEndingLast = addDaysIso(weekEndingThis, -7);

        const thisWeek = rows.find((r) => r.weekEnding === weekEndingThis) || null;
        const lastWeek = rows.find((r) => r.weekEnding === weekEndingLast) || null;

        const last4 = rows.slice(-4);
        const last4Sum = sumRows(last4);
        const last4AvgQualified = last4.length ? last4.reduce((acc, r) => acc + Number(r.pctQualified || 0), 0) / last4.length : 0;
        const last4AvgConversion = last4.length ? last4.reduce((acc, r) => acc + Number(r.totalConversion || 0), 0) / last4.length : 0;
        const last4Range = last4.length ? `${last4[0].weekEnding} → ${last4[last4.length - 1].weekEnding}` : "—";

        intakeKpis = [
          {
            id: "last4",
            label: "Last 4 weeks (total)",
            value: last4Range,
            sub: last4.length
              ? `Calls: ${fmt(last4Sum.calls)} · Held: ${fmt(last4Sum.held)} · Cancelled: ${fmt(
                  last4Sum.cancelled
                )} · Avg Qualified: ${fmtPct(last4AvgQualified)} · Avg Conversion: ${fmtPct(last4AvgConversion)}`
              : "No weekly rows found",
          },
          {
            id: "last_week",
            label: "Last week",
            value: lastWeek ? lastWeek.weekEnding : weekEndingLast,
            sub: lastWeek
              ? `Calls: ${fmt(lastWeek.totalIntakeCalls)} · Held: ${fmt(lastWeek.designMeetingsHeld)} · Cancelled: ${fmt(
                  lastWeek.designMeetingsCancelled
                )} · Qualified: ${fmtPct(lastWeek.pctQualified)} · Conversion: ${fmtPct(lastWeek.totalConversion)}`
              : "No row found for last week",
          },
          {
            id: "this_week",
            label: "This week",
            value: thisWeek ? thisWeek.weekEnding : weekEndingThis,
            sub: thisWeek
              ? `Calls: ${fmt(thisWeek.totalIntakeCalls)} · Held: ${fmt(thisWeek.designMeetingsHeld)} · Cancelled: ${fmt(
                  thisWeek.designMeetingsCancelled
                )} · Qualified: ${fmtPct(thisWeek.pctQualified)} · Conversion: ${fmtPct(thisWeek.totalConversion)}`
              : "No row found for this week",
          },
        ];
      } catch {
        // fall through to DB summary
      }
    }
  }

  if (!intakeKpis.length) {
    const intakeTable: any = anyPrisma.reportTable
      ? await anyPrisma.reportTable.findUnique({ where: { slug: "intake-reporting" }, include: { rows: { orderBy: { sortOrder: "asc" } } } })
      : null;

    const intakeTotals = (intakeTable?.rows || []).reduce(
      (acc: any, r: any) => {
        const d = r.data || {};
        const n = (v: any) => {
          const x = Number(v);
          return Number.isFinite(x) ? x : 0;
        };
        acc.scheduled += n(d.scheduled_intake);
        acc.qualified += n(d.qualified);
        acc.designHeld += n(d.design_meetings_held);
        acc.docTours += n(d.doc_tour_held);
        acc.signings += n(d.signing_held);
        return acc;
      },
      { scheduled: 0, qualified: 0, designHeld: 0, docTours: 0, signings: 0 }
    );

    intakeKpis = [
      { id: "scheduled", label: "Scheduled intake", value: intakeTotals.scheduled.toLocaleString() },
      {
        id: "qualified",
        label: "Qualified",
        value: intakeTotals.qualified.toLocaleString(),
        sub: intakeTotals.scheduled ? `${Math.round((intakeTotals.qualified / intakeTotals.scheduled) * 1000) / 10}% of scheduled` : undefined,
      },
      { id: "design", label: "Design meetings held", value: intakeTotals.designHeld.toLocaleString() },
      { id: "doc_tours", label: "Doc tours held", value: intakeTotals.docTours.toLocaleString() },
      { id: "signings", label: "Signings held", value: intakeTotals.signings.toLocaleString() },
    ];
  }

  // --- Work in process (pipelines) ---
  const epStats = await getStageStats("Estate Planning Representation Pipeline", firmId);
  const intakePipelineStats = await getStageStats("Intake Pipeline", firmId);

  const epTotal = epStats.reduce(
    (acc, r) => {
      acc.count += r.matterCount;
      acc.valueCents += r.totalValueCents;
      return acc;
    },
    { count: 0, valueCents: 0 }
  );

  const wipKpis: Kpi[] = [
    { id: "ep_matters", label: "EP pipeline matters", value: epTotal.count.toLocaleString() },
    { id: "ep_value", label: "EP pipeline value", value: usd(epTotal.valueCents) },
  ];

  // --- Today’s meetings ---
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const dayEnd = endOfDay(now);
  const meetings = anyPrisma.appointment
    ? await anyPrisma.appointment.findMany({
        where: {
          status: "SCHEDULED",
          startsAt: { gte: dayStart, lte: dayEnd },
          ...(firmId ? { type: { is: { firmId } } } : {}),
        },
        include: { type: true },
        orderBy: { startsAt: "asc" },
        take: 25,
      })
    : [];

  return (
    <DashboardClient
      financialKpis={financialKpis}
      intakeKpis={intakeKpis}
      wipKpis={wipKpis}
      meetings={meetings.map((m: any) => ({
        id: m.id,
        typeName: m.type?.name || "(Meeting)",
        clientName: m.clientName || "(No name)",
        startsAt: new Date(m.startsAt).toISOString(),
        endsAt: new Date(m.endsAt).toISOString(),
        assignedGoogleEmail: m.assignedGoogleEmail || "",
      }))}
      billing={billing}
      wipBreakdown={{ preDesignStages: intakePipelineStats, preDocTourStages: epStats }}
    />
  );
}
