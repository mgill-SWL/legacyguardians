import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./ui";

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

  // --- Intake KPIs (DB summary) ---
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

  const intakeKpis: Kpi[] = [
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
