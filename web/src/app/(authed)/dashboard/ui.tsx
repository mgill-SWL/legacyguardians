"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type Kpi = { id: string; label: string; value: string; sub?: string };

type IntakeStatsBlock = {
  title: string;
  periodLabel: string;
  calls: number;
  designBooked: number;
  designHeld: number;
  designCancelled: number;
  documentToursHeld: number;
  pctQualified: number;
  totalConversion: number;
};
type Meeting = {
  id: string;
  typeName: string;
  clientName: string;
  startsAt: string;
  endsAt: string;
  assignedGoogleEmail: string;
};

type BillingPoint = { key: string; label: string; billedCents: number; collectedCents: number };

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

const DEFAULT_WIDGETS = ["financial", "intake", "wip", "tasks", "meetings", "billing"] as const;

export function DashboardClient({
  financialKpis,
  intakeKpis,
  intakeStatsAtGlance,
  wipKpis,
  meetings,
  billing,
  wipBreakdown,
  tasks,
}: {
  financialKpis: Kpi[];
  intakeKpis: Kpi[];
  intakeStatsAtGlance?: IntakeStatsBlock[];
  wipKpis: Kpi[];
  meetings: Meeting[];
  billing: { series: BillingPoint[]; billedMtdCents: number; collectedMtdCents: number };
  wipBreakdown: { preDesignStages: StageStat[]; preDocTourStages: StageStat[] };
  tasks: DashboardTask[];
}) {
  const [editMode, setEditMode] = useState(false);

  const [order, setOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDGETS.slice();
    try {
      const raw = localStorage.getItem("sw.dashboard.layout.v1");
      if (!raw) return DEFAULT_WIDGETS.slice();
      const parsed = JSON.parse(raw) as { order?: string[] };
      if (Array.isArray(parsed.order) && parsed.order.length) return parsed.order;
    } catch {
      // ignore
    }
    return DEFAULT_WIDGETS.slice();
  });

  const [hidden, setHidden] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem("sw.dashboard.layout.v1");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as { hidden?: Record<string, boolean> };
      if (parsed.hidden && typeof parsed.hidden === "object") return parsed.hidden;
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem("sw.dashboard.layout.v1", JSON.stringify({ order, hidden }));
    } catch {
      // ignore
    }
  }, [order, hidden]);

  function move(id: string, dir: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = prev.slice();
      const tmp = copy[idx];
      copy[idx] = copy[nextIdx];
      copy[nextIdx] = tmp;
      return copy;
    });
  }

  function setHiddenFlag(id: string, v: boolean) {
    setHidden((prev) => ({ ...prev, [id]: v }));
  }

  function resetLayout() {
    setOrder(DEFAULT_WIDGETS.slice());
    setHidden({});
  }

const widgetDefs: Record<
    string,
    {
      title: string;
      render: () => ReactNode;
      className: string;
    }
  > = {
    financial: {
      title: "Scoreboard",
      className: "lg:col-span-3",
      render: () => <KpiGrid title="Scoreboard" subtitle="Monthly goal • billed/collected MTD" kpis={financialKpis} />,
    },
    intake: {
      title: "Intake",
      className: "lg:col-span-3",
      render: () =>
        intakeStatsAtGlance?.length ? (
          <IntakeStatsAtAGlance blocks={intakeStatsAtGlance} />
        ) : (
          <KpiGrid title="Intake" subtitle="Calls • design meetings booked • conversions" kpis={intakeKpis} />
        ),
    },
    wip: {
      title: "Work-in-Process",
      className: "lg:col-span-3",
      render: () => (
        <div style={{ display: "grid", gap: 12 }}>
          <KpiGrid title="Work-in-Process" subtitle="Pipeline volume + stage rollups" kpis={wipKpis} />
          <WipStages preDesign={wipBreakdown.preDesignStages} preDocTour={wipBreakdown.preDocTourStages} />
        </div>
      ),
    },
    billing: {
      title: "Billing summary",
      className: "lg:col-span-2",
      render: () => <BillingSummary series={billing.series} billedMtdCents={billing.billedMtdCents} collectedMtdCents={billing.collectedMtdCents} />,
    },
    meetings: {
      title: "Today’s meetings",
      className: "lg:col-span-1",
      render: () => <MeetingsList meetings={meetings} />,
    },
    tasks: {
      title: "Tasks",
      className: "lg:col-span-1",
      render: () => <DashboardTasks tasks={tasks} />,
    },
  };

  const ordered = order.filter((id) => widgetDefs[id]);
  const hiddenList = ordered.filter((id) => hidden[id]);
  const shownList = ordered.filter((id) => !hidden[id]);

  return (
    <div className="sw-page" style={{ position: "relative" }}>
      <div className="sw-pageHeader">
        <div>
          <h1 className="sw-h1">Dashboard</h1>
          <div className="sw-muted" style={{ marginTop: 6 }}>
            Editable layout • KPIs • Today’s meetings • Billing summary
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="sw-btn" onClick={() => setEditMode((v) => !v)}>
            {editMode ? "Done" : "Customize"}
          </button>
          {editMode ? (
            <button className="sw-btn sw-btnGhost" onClick={resetLayout}>
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {editMode ? (
        <div className="sw-card sw-card-pad" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900 }}>Layout</div>
          <div className="sw-muted" style={{ marginTop: 6 }}>
            Reorder sections and hide/show widgets. (Persisted locally for now.)
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {ordered.map((id, idx) => (
              <div
                key={id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--sw-border)",
                  background: "rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={!hidden[id]}
                    onChange={(e) => setHiddenFlag(id, !e.target.checked)}
                    aria-label={`Show ${widgetDefs[id].title}`}
                  />
                  <div>
                    <div style={{ fontWeight: 900 }}>{widgetDefs[id].title}</div>
                    <div className="sw-muted" style={{ fontSize: 12 }}>
                      {hidden[id] ? "Hidden" : "Visible"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="sw-btn sw-btnSm" disabled={idx === 0} onClick={() => move(id, -1)}>
                    ↑
                  </button>
                  <button className="sw-btn sw-btnSm" disabled={idx === ordered.length - 1} onClick={() => move(id, 1)}>
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>

          {hiddenList.length ? (
            <div className="sw-muted" style={{ marginTop: 10, fontSize: 12 }}>
              Hidden: {hiddenList.map((id) => widgetDefs[id].title).join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 12, marginTop: 14 }}>
        {shownList.map((id) => (
          <div key={id} className={widgetDefs[id].className}>
            {widgetDefs[id].render()}
          </div>
        ))}
      </div>

      <QuickActions />
    </div>
  );
}

function IntakeStatsAtAGlance({ blocks }: { blocks: IntakeStatsBlock[] }) {
  const fmtInt = (n: number) => Math.round(Number.isFinite(n) ? n : 0).toLocaleString();
  const fmtPct = (v: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return "0%";
    const asPct = n <= 1 ? n * 100 : n;
    return `${Math.round(asPct)}%`;
  };

  return (
    <div className="sw-card sw-card-pad">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900 }}>Intake</div>
          <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
            Stats at a glance
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 12, marginTop: 12 }}>
        {blocks.map((b) => (
          <div
            key={b.title}
            style={{
              border: "1px solid var(--sw-border)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
              <div style={{ fontWeight: 950 }}>{b.title}</div>
              <div className="sw-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                {b.periodLabel}
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div className="sw-muted" style={{ fontSize: 12, fontWeight: 900 }}>
                  Total Intake Calls
                </div>
                <div style={{ fontSize: 18, fontWeight: 950 }}>{fmtInt(b.calls)}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, fontSize: 13 }}>
                <div className="sw-muted" style={{ fontWeight: 900 }}>
                  Design Meetings BOOKED
                </div>
                <div style={{ fontWeight: 950 }}>{fmtInt(b.designBooked)}</div>

                <div className="sw-muted" style={{ fontWeight: 900 }}>
                  Design Meetings HELD
                </div>
                <div style={{ fontWeight: 950 }}>{fmtInt(b.designHeld)}</div>

                <div className="sw-muted" style={{ fontWeight: 900 }}>
                  Design Meetings CANCELLED
                </div>
                <div style={{ fontWeight: 950 }}>{fmtInt(b.designCancelled)}</div>

                <div className="sw-muted" style={{ fontWeight: 900 }}>
                  Document Tours HELD
                </div>
                <div style={{ fontWeight: 950 }}>{fmtInt(b.documentToursHeld)}</div>

                <div className="sw-muted" style={{ fontWeight: 900 }}>
                  % Qualified
                </div>
                <div style={{ fontWeight: 950 }}>{fmtPct(b.pctQualified)}</div>

                <div className="sw-muted" style={{ fontWeight: 900 }}>
                  Total Conversion
                </div>
                <div style={{ fontWeight: 950 }}>{fmtPct(b.totalConversion)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiGrid({ title, subtitle, kpis }: { title: string; subtitle?: string; kpis: Kpi[] }) {
  return (
    <div className="sw-card sw-card-pad">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900 }}>{title}</div>
          {subtitle ? (
            <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 10,
        }}
      >
        {kpis.map((k) => (
          <div
            key={k.id}
            style={{
              border: "1px solid var(--sw-border)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div className="sw-muted" style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.2 }}>
              {k.label}
            </div>
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: 950 }}>{k.value}</div>
            {k.sub ? (
              <div className="sw-muted" style={{ marginTop: 4, fontSize: 12 }}>
                {k.sub}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function WipStages({ preDesign, preDocTour }: { preDesign: StageStat[]; preDocTour: StageStat[] }) {
  const money = (cents: number) => (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });

  function StageTable({ title, rows }: { title: string; rows: StageStat[] }) {
    return (
      <div className="sw-card sw-card-pad">
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table className="sw-table">
            <thead>
              <tr>
                <th className="sw-th">Stage</th>
                <th className="sw-th">Total value</th>
                <th className="sw-th">Total matters</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stageName} className="sw-tr">
                  <td className="sw-td" style={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                    {r.stageName}
                  </td>
                  <td className="sw-td">{money(r.totalValueCents)}</td>
                  <td className="sw-td">{r.matterCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sw-muted" style={{ marginTop: 10, fontSize: 12 }}>
          Note: “Total value” uses each matter’s value field (shown on pipeline cards).
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 12 }}>
      <StageTable title="Pre-design meeting stages" rows={preDesign} />
      <StageTable title="Pre-document tour stages" rows={preDocTour} />
    </div>
  );
}

function DashboardTasks({ tasks }: { tasks: DashboardTask[] }) {
  const [nowMs] = useState(() => Date.now());

  function fmtDate(iso: string | null) {
    if (!iso) return "No deadline";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function overdue(iso: string | null) {
    if (!iso) return false;
    const d = new Date(iso);
    d.setHours(23, 59, 59, 999);
    return d.getTime() < nowMs;
  }

  return (
    <div className="sw-card sw-card-pad" style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 900 }}>Open tasks</div>
        <Link className="sw-muted" style={{ fontSize: 12, textDecoration: "none" }} href="/tasks">
          Tasks →
        </Link>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {tasks.length ? (
          tasks.map((task) => (
            <div
              key={task.id}
              style={{
                border: "1px solid var(--sw-border)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(255,255,255,0.02)",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 950 }}>{task.title}</div>
                <div className="sw-muted" style={{ fontSize: 12, whiteSpace: "nowrap", color: overdue(task.deadline) ? "#ef4444" : undefined }}>
                  {fmtDate(task.deadline)}
                </div>
              </div>
              <div className="sw-muted" style={{ fontSize: 12 }}>
                {task.assigneeName}{task.matterName ? ` • ${task.matterName}` : ""}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
                <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,0.06)", border: "1px solid var(--sw-border)" }}>
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, task.completionPercent))}%`,
                      height: "100%",
                      background: "linear-gradient(135deg, rgba(110,231,255,0.75), rgba(167,139,250,0.65))",
                    }}
                  />
                </div>
                <div className="sw-muted" style={{ fontSize: 12, fontWeight: 900 }}>{task.completionPercent}%</div>
              </div>
            </div>
          ))
        ) : (
          <div className="sw-muted" style={{ padding: 12, border: "1px dashed var(--sw-border)", borderRadius: 12 }}>
            No open tasks.
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingsList({ meetings }: { meetings: Meeting[] }) {
  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return (
    <div className="sw-card sw-card-pad" style={{ height: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontWeight: 900 }}>Today’s booked meetings</div>
        <Link className="sw-muted" style={{ fontSize: 12, textDecoration: "none" }} href="/management/booking">
          Booking →
        </Link>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {meetings.length ? (
          meetings.map((m) => (
            <div
              key={m.id}
              style={{
                border: "1px solid var(--sw-border)",
                borderRadius: 12,
                padding: 12,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 950 }}>{m.clientName}</div>
                <div style={{ fontWeight: 900 }}>{fmtTime(m.startsAt)}</div>
              </div>
              <div className="sw-muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.3 }}>
                {m.typeName}
                {m.assignedGoogleEmail ? ` • ${m.assignedGoogleEmail}` : ""}
              </div>
            </div>
          ))
        ) : (
          <div className="sw-muted" style={{ padding: 12, border: "1px dashed var(--sw-border)", borderRadius: 12 }}>
            No meetings scheduled today.
          </div>
        )}
      </div>
    </div>
  );
}

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function BillingSummary({
  series,
  billedMtdCents,
  collectedMtdCents,
}: {
  series: BillingPoint[];
  billedMtdCents: number;
  collectedMtdCents: number;
}) {
  const maxCents = Math.max(
    1,
    ...series.map((p) => Math.max(p.billedCents || 0, p.collectedCents || 0))
  );

  return (
    <div className="sw-card sw-card-pad">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900 }}>Billing summary</div>
          <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
            Last {series.length} months
          </div>
        </div>
        <Link className="sw-muted" style={{ fontSize: 12, textDecoration: "none" }} href="/management/accounting">
          Accounting →
        </Link>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="sw-badge">Billed (MTD): {usd(billedMtdCents)}</div>
        <div className="sw-badge">Collected (MTD): {usd(collectedMtdCents)}</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <svg viewBox="0 0 600 220" width="100%" height={220} role="img" aria-label="Billing summary chart">
          <rect x="0" y="0" width="600" height="220" fill="transparent" />

          {/* axes baseline */}
          <line x1="30" y1="190" x2="590" y2="190" stroke="rgba(128,128,128,0.35)" strokeWidth="1" />

          {series.map((p, i) => {
            const groupW = 78;
            const left = 40 + i * groupW;
            const barW = 20;
            const gap = 8;
            const maxH = 140;
            const billedH = Math.round((Math.max(0, p.billedCents) / maxCents) * maxH);
            const collectedH = Math.round((Math.max(0, p.collectedCents) / maxCents) * maxH);
            const baseY = 190;
            const billedX = left;
            const collectedX = left + barW + gap;

            return (
              <g key={p.key}>
                <rect
                  x={billedX}
                  y={baseY - billedH}
                  width={barW}
                  height={billedH}
                  rx={6}
                  fill="rgba(110, 231, 255, 0.55)"
                />
                <rect
                  x={collectedX}
                  y={baseY - collectedH}
                  width={barW}
                  height={collectedH}
                  rx={6}
                  fill="rgba(167, 139, 250, 0.45)"
                />
                <text x={left + 24} y={208} textAnchor="middle" fontSize={11} fill="rgba(128,128,128,0.95)">
                  {p.label}
                </text>
              </g>
            );
          })}

          {/* legend */}
          <g>
            <rect x="36" y="18" width="10" height="10" rx="2" fill="rgba(110, 231, 255, 0.55)" />
            <text x="52" y="27" fontSize={12} fill="rgba(128,128,128,0.95)">
              Billed
            </text>
            <rect x="110" y="18" width="10" height="10" rx="2" fill="rgba(167, 139, 250, 0.45)" />
            <text x="126" y="27" fontSize={12} fill="rgba(128,128,128,0.95)">
              Collected
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function QuickActions() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 50 }}>
      {open ? (
        <div
          className="sw-card"
          style={{
            width: 320,
            padding: 14,
            boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontWeight: 950 }}>Quick actions</div>
            <button className="sw-btn sw-btnSm sw-btnGhost" onClick={() => setOpen(false)} aria-label="Close quick actions">
              ✕
            </button>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <Link className="sw-btn" href="/crm/inbox" onClick={() => setOpen(false)}>
              Inbox
            </Link>
            <Link className="sw-btn" href="/crm/queue" onClick={() => setOpen(false)}>
              Queue
            </Link>
            <Link className="sw-btn" href="/management/booking" onClick={() => setOpen(false)}>
              Booking settings
            </Link>
            <Link className="sw-btn" href="/management/kpis" onClick={() => setOpen(false)}>
              KPI imports
            </Link>
            <Link className="sw-btn" href="/management/accounting" onClick={() => setOpen(false)}>
              Accounting
            </Link>
          </div>

          <div className="sw-muted" style={{ marginTop: 10, fontSize: 12, lineHeight: 1.3 }}>
            (Modeled after the Lawmatics quick actions toggle.)
          </div>
        </div>
      ) : null}

      <button className="sw-btn sw-btnPrimary" onClick={() => setOpen((v) => !v)} aria-label="Toggle quick actions">
        ⚡ Quick actions
      </button>
    </div>
  );
}
