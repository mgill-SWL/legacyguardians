"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Stage = {
  id: string;
  name: string;
  colorHex: string | null;
};

type Matter = {
  id: string;
  displayName: string;
  status: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  estimatedValueCents: number;
};

type LinkRec = {
  id: string;
  stageId: string;
  matter: Matter;
};

export function PipelineBoard({
  pipelineName,
  stages,
  links,
}: {
  pipelineName: string;
  stages: Stage[];
  links: LinkRec[];
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const byStage = useMemo(() => {
    const m = new Map<string, LinkRec[]>();
    for (const s of stages) m.set(s.id, []);
    for (const l of links) {
      const arr = m.get(l.stageId);
      if (arr) arr.push(l);
    }
    return m;
  }, [stages, links]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{pipelineName}</h1>
          <div style={{ marginTop: 6, color: "var(--sw-muted, #aab4d4)" }}>Kanban view</div>
        </div>
        <Link href="/pipeline/settings" style={{ color: "inherit" }}>
          Pipeline setup →
        </Link>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(280px, 340px)",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        {stages.map((s) => {
          const items = byStage.get(s.id) || [];
          const isCollapsed = !!collapsed[s.id];

          const accent = s.colorHex || "rgba(110,231,255,0.6)";

          return (
            <div
              key={s.id}
              style={{
                border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                minHeight: 240,
                display: "grid",
                gridTemplateRows: "auto 1fr",
                width: isCollapsed ? 84 : undefined,
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: "0 0 auto 0",
                    height: 4,
                    background: accent,
                    borderTopLeftRadius: 14,
                    borderTopRightRadius: 14,
                  }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {isCollapsed ? s.name.slice(0, 1) : s.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      title={`${items.length} matters`}
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "var(--sw-muted, #aab4d4)",
                      }}
                    >
                      {items.length}
                    </div>
                    <button
                      onClick={() => setCollapsed((c) => ({ ...c, [s.id]: !c[s.id] }))}
                      style={{
                        border: "1px solid rgba(255,255,255,0.18)",
                        background: "transparent",
                        color: "inherit",
                        borderRadius: 10,
                        padding: "4px 8px",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      title={isCollapsed ? "Expand" : "Collapse"}
                    >
                      {isCollapsed ? ">" : "<"}
                    </button>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  overflowY: "auto",
                  maxHeight: "calc(100vh - 220px)",
                }}
              >
                {!isCollapsed ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {items.map((l) => (
                      <MatterCard key={l.id} m={l.matter} />
                    ))}
                    {items.length === 0 ? (
                      <div style={{ color: "var(--sw-muted, #aab4d4)", fontSize: 12 }}>No matters.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmtMoney(cents: number) {
  if (!cents) return "";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function MatterCard({ m }: { m: Matter }) {
  const value = fmtMoney(m.estimatedValueCents);

  return (
    <Link
      href={`/matters/${m.id}`}
      style={{
        display: "block",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        textDecoration: "none",
        color: "inherit",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 10px",
          fontWeight: 900,
          background: "rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {m.displayName}
      </div>
      <div style={{ padding: 10, display: "grid", gap: 6, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
        {m.primaryPhone ? <div>{m.primaryPhone}</div> : null}
        {m.primaryEmail ? <div>{m.primaryEmail}</div> : null}
        {value ? <div style={{ color: "inherit", fontWeight: 900 }}>{value}</div> : null}
      </div>
    </Link>
  );
}
