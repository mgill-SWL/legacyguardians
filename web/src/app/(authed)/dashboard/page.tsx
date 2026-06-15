import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./ui";
import { getDefaultGoogleEmailForUser, getIntakeKpisFromSheet } from "@/lib/kpis/intakeSheet";

export const dynamic = "force-dynamic";

type Kpi = { id: string; label: string; value: string; sub?: string };

type IntakeStatsBlock = {
  title: string;
  // For week blocks, this is the Week Ending ISO date.
  // For rollups, this is a range like "YYYY-MM-DD → YYYY-MM-DD".
  periodLabel: string;
  calls: number;
  designBooked: number;
  designHeld: number;
  designCancelled: number;
  documentToursHeld: number;
  pctQualified: number;
  totalConversion: number;
};
type StageStat = { stageName: string; matterCount: number; totalValueCents: number };
type DashboardTask = {
  id: string;
  title: string;
  deadline: string | null;
  completionPercent: number;
  assigneeName: string;
  matterId: string | null;
  matterName: string | null;
};
type RawDashboardTask = {
  id: string;
  title: string;
  deadline: Date | string | null;
  completionPercent: number;
  assigneeUser?: { name: string | null; email: string | null } | null;
  matter?: { id: string; displayName: string } | null;
};

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
  if (!prisma.pipeline || !prisma.matterPipeline) return [];

  const pipeline = await prisma.pipeline.findFirst({
    where: { name: pipelineName },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!pipeline) return [];

  const links = await prisma.matterPipeline.findMany({
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

  const order = new Map<string, number>((pipeline.stages || []).map((s, idx) => [s.name, s.sortOrder ?? idx] as const));
  return Array.from(byStage.values()).sort((a, b) => (order.get(a.stageName) ?? 9999) - (order.get(b.stageName) ?? 9999));
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = prisma.user ? await prisma.user.findUnique({ where: { email: session.user.email } }) : null;
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

  const events: { eventType: string; eventDate: Date; amountCents: number }[] = prisma.matterFinancialEvent
    ? await prisma.matterFinancialEvent.findMany({
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
  const scoreboardRow = prisma.reportTable
    ? await prisma.reportTable.findUnique({ where: { slug: "firm-scoreboard" }, include: { rows: { orderBy: { sortOrder: "asc" } } } })
    : null;
  const scoreboardData = (scoreboardRow?.rows?.[0]?.data ?? {}) as Record<string, unknown>;
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
  let intakeStatsAtGlance: IntakeStatsBlock[] = [];

  function lastCompletedFridayIso(d: Date) {
    // Most recent Friday strictly before today (local). If today is Friday, this returns last week's Friday.
    const day = d.getDay(); // 0=Sun .. 5=Fri
    const delta = (day - 5 + 7) % 7;
    const daysBack = delta === 0 ? 7 : delta;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - daysBack)).toISOString().slice(0, 10);
  }

  function weekEndingFridayIso(d: Date) {
    // Upcoming Friday for the current week. If today is Friday, this returns today.
    const day = d.getDay(); // 0=Sun .. 5=Fri
    const delta = (5 - day + 7) % 7;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + delta)).toISOString().slice(0, 10);
  }

  function addDaysIso(iso: string, days: number) {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const da = Number(m[3]);
    return new Date(Date.UTC(y, mo, da + days)).toISOString().slice(0, 10);
  }

  function n(v: unknown) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function buildStatsAtGlanceFromRows(
    rows: Array<{
      weekEnding: string;
      totalIntakeCalls: number;
      designMeetingsHeld: number;
      designMeetingsCancelled: number;
      designMeetingsBooked?: number;
      documentToursHeld?: number;
      pctQualified: number;
      totalConversion: number;
    }>
  ) {
    const byWeek = new Map(rows.map((r) => [r.weekEnding, r] as const));

    const thisWeekEnding = weekEndingFridayIso(now);
    const lastWeekEnding = lastCompletedFridayIso(now);
    const last4WeekEndings = [
      addDaysIso(lastWeekEnding, -21),
      addDaysIso(lastWeekEnding, -14),
      addDaysIso(lastWeekEnding, -7),
      lastWeekEnding,
    ];

    const pick = (weekEnding: string) =>
      byWeek.get(weekEnding) || {
        weekEnding,
        totalIntakeCalls: 0,
        designMeetingsBooked: 0,
        designMeetingsHeld: 0,
        designMeetingsCancelled: 0,
        documentToursHeld: 0,
        pctQualified: 0,
        totalConversion: 0,
      };

    const thisWeek = pick(thisWeekEnding);
    const lastWeek = pick(lastWeekEnding);

    const last4 = last4WeekEndings.map(pick);
    const last4Calls = last4.reduce((acc, r) => acc + n(r.totalIntakeCalls), 0);
    const last4Booked = last4.reduce((acc, r) => acc + n(r.designMeetingsBooked ?? n(r.designMeetingsHeld) + n(r.designMeetingsCancelled)), 0);
    const last4Held = last4.reduce((acc, r) => acc + n(r.designMeetingsHeld), 0);
    const last4Cancelled = last4.reduce((acc, r) => acc + n(r.designMeetingsCancelled), 0);
    const last4DocumentToursHeld = last4.reduce((acc, r) => acc + n(r.documentToursHeld), 0);

    // Weighted averages (weight by calls) so rollups feel consistent.
    const last4AvgQualified = last4Calls
      ? last4.reduce((acc, r) => acc + n(r.pctQualified) * n(r.totalIntakeCalls), 0) / last4Calls
      : 0;
    const last4AvgConversion = last4Calls
      ? last4.reduce((acc, r) => acc + n(r.totalConversion) * n(r.totalIntakeCalls), 0) / last4Calls
      : 0;

    intakeStatsAtGlance = [
      {
        title: "Last 4 weeks",
        periodLabel: `${last4WeekEndings[0]} → ${last4WeekEndings[last4WeekEndings.length - 1]}`,
        calls: last4Calls,
        designBooked: last4Booked,
        designHeld: last4Held,
        designCancelled: last4Cancelled,
        documentToursHeld: last4DocumentToursHeld,
        pctQualified: last4AvgQualified,
        totalConversion: last4AvgConversion,
      },
      {
        title: "Last week",
        periodLabel: lastWeekEnding,
        calls: n(lastWeek.totalIntakeCalls),
        designBooked: n(lastWeek.designMeetingsBooked ?? n(lastWeek.designMeetingsHeld) + n(lastWeek.designMeetingsCancelled)),
        designHeld: n(lastWeek.designMeetingsHeld),
        designCancelled: n(lastWeek.designMeetingsCancelled),
        documentToursHeld: n(lastWeek.documentToursHeld),
        pctQualified: n(lastWeek.pctQualified),
        totalConversion: n(lastWeek.totalConversion),
      },
      {
        title: "This week",
        periodLabel: thisWeekEnding,
        calls: n(thisWeek.totalIntakeCalls),
        designBooked: n(thisWeek.designMeetingsBooked ?? n(thisWeek.designMeetingsHeld) + n(thisWeek.designMeetingsCancelled)),
        designHeld: n(thisWeek.designMeetingsHeld),
        designCancelled: n(thisWeek.designMeetingsCancelled),
        documentToursHeld: n(thisWeek.documentToursHeld),
        pctQualified: n(thisWeek.pctQualified),
        totalConversion: n(thisWeek.totalConversion),
      },
    ];
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

        buildStatsAtGlanceFromRows(rows);
      } catch {
        // fall through to DB summary
      }
    }
  }

  if (!intakeStatsAtGlance.length) {
    const intakeTable = prisma.reportTable
      ? await prisma.reportTable.findUnique({ where: { slug: "intake-reporting" }, include: { rows: { orderBy: { sortOrder: "asc" } } } })
      : null;

    // If we have week-keyed rows, build the same at-a-glance blocks.
    if (intakeTable?.rows?.length) {
      const rr = (intakeTable.rows || []).map((r) => {
        const d = (r.data ?? {}) as Record<string, unknown>;
        return {
          weekEnding: r.rowKey,
          totalIntakeCalls: n(d.total_intake_calls),
          designMeetingsBooked: n(d.design_meetings_booked) || n(d.design_meetings_held) + n(d.design_meetings_cancelled),
          designMeetingsHeld: n(d.design_meetings_held),
          designMeetingsCancelled: n(d.design_meetings_cancelled),
          documentToursHeld: n(d.document_tours_held) || n(d.doc_tour_held),
          pctQualified: n(d.pct_qualified),
          totalConversion: n(d.total_conversion),
        };
      });
      buildStatsAtGlanceFromRows(rr);
    }

    const intakeTotals = (intakeTable?.rows || []).reduce(
      (acc, r) => {
        const d = (r.data ?? {}) as Record<string, unknown>;
        acc.scheduled += n(d.scheduled_intake);
        acc.qualified += n(d.qualified);
        acc.designBooked += n(d.design_meetings_booked) || n(d.design_meetings_held) + n(d.design_meetings_cancelled);
        acc.designHeld += n(d.design_meetings_held);
        acc.docTours += n(d.doc_tour_held);
        acc.signings += n(d.signing_held);
        return acc;
      },
      { scheduled: 0, qualified: 0, designBooked: 0, designHeld: 0, docTours: 0, signings: 0 }
    );

    intakeKpis = [
      { id: "scheduled", label: "Scheduled intake", value: intakeTotals.scheduled.toLocaleString() },
      {
        id: "qualified",
        label: "Qualified",
        value: intakeTotals.qualified.toLocaleString(),
        sub: intakeTotals.scheduled ? `${Math.round((intakeTotals.qualified / intakeTotals.scheduled) * 1000) / 10}% of scheduled` : undefined,
      },
      { id: "design_booked", label: "Design meetings booked", value: intakeTotals.designBooked.toLocaleString() },
      { id: "design", label: "Design meetings held", value: intakeTotals.designHeld.toLocaleString() },
      { id: "doc_tours", label: "Document tours held", value: intakeTotals.docTours.toLocaleString() },
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
  const meetings = prisma.appointment
    ? await prisma.appointment.findMany({
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

  const tasks: DashboardTask[] = prisma.task
    ? (
        await prisma.task.findMany({
          where: {
            ...(firmId ? { firmId } : {}),
            completionPercent: { lt: 100 },
          },
          orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
          take: 8,
          include: {
            assigneeUser: { select: { name: true, email: true } },
            matter: { select: { id: true, displayName: true } },
          },
        })
      ).map((t: RawDashboardTask) => ({
        id: t.id,
        title: t.title,
        deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
        completionPercent: Number(t.completionPercent || 0),
        assigneeName: t.assigneeUser?.name || t.assigneeUser?.email || "Unassigned",
        matterId: t.matter?.id || null,
        matterName: t.matter?.displayName || null,
      }))
    : [];

  return (
      <DashboardClient
        financialKpis={financialKpis}
        intakeKpis={intakeKpis}
        intakeStatsAtGlance={intakeStatsAtGlance}
        wipKpis={wipKpis}
        meetings={meetings.map((m) => ({
          id: m.id,
          typeName: m.type?.name || "(Meeting)",
        clientName: m.clientName || "(No name)",
        startsAt: new Date(m.startsAt).toISOString(),
        endsAt: new Date(m.endsAt).toISOString(),
        assignedGoogleEmail: m.assignedGoogleEmail || "",
      }))}
      billing={billing}
      wipBreakdown={{ preDesignStages: intakePipelineStats, preDocTourStages: epStats }}
      tasks={tasks}
    />
  );
}
