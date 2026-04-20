"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  intakeSpecialistEmail?: string | null;
  leadAttorneyEmail?: string | null;
};

type LinkRec = {
  id: string;
  stageId: string;
  matter: Matter;
};

export function PipelineBoard({
  pipelineId,
  pipelineName,
  stages,
  links,
}: {
  pipelineId: string;
  pipelineName: string;
  stages: Stage[];
  links: LinkRec[];
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  async function removeCard(linkId: string) {
    await fetch(`/api/matter-pipeline/${linkId}`, { method: "DELETE" });
    router.refresh();
  }

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(110,231,255,0.45)",
              background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
              fontWeight: 900,
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Add matter
          </button>
          <Link href="/pipeline/settings" style={{ color: "inherit" }}>
            Pipeline setup →
          </Link>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "stretch",
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
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                const linkId = e.dataTransfer.getData("text/plain");
                if (!linkId) return;
                try {
                  await fetch(`/api/matter-pipeline/${linkId}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ stageId: s.id }),
                  });
                } finally {
                  router.refresh();
                }
              }}
              style={{
                border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                minHeight: 240,
                display: "grid",
                gridTemplateRows: "auto 1fr",
                flex: "0 0 auto",
                width: isCollapsed ? 84 : 320,
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
                      <MatterCard key={l.id} linkId={l.id} m={l.matter} onRemove={removeCard} />
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

      {adding ? (
        <AddMatterModal
          pipelineId={pipelineId}
          stageId={stages[0]?.id || null}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function fmtMoney(cents: number) {
  if (!cents) return "";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function MatterCard({
  linkId,
  m,
  onRemove,
}: {
  linkId: string;
  m: Matter;
  onRemove: (linkId: string) => void | Promise<void>;
}) {
  const value = fmtMoney(m.estimatedValueCents);

  return (
    <Link
      href={`/matters/${m.id}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", linkId);
        e.dataTransfer.effectAllowed = "move";
      }}
      style={{
        position: "relative",
        display: "block",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.18)",
        textDecoration: "none",
        color: "inherit",
        overflow: "hidden",
      }}
    >
      <button
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm("Remove this matter from the pipeline?")) return;
          await onRemove(linkId);
        }}
        title="Remove from pipeline"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 26,
          height: 26,
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.18)",
          background: "rgba(0,0,0,0.18)",
          color: "inherit",
          cursor: "pointer",
          fontWeight: 900,
        }}
      >
        ✕
      </button>
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
        {m.intakeSpecialistEmail ? <div>Intake: {m.intakeSpecialistEmail}</div> : null}
        {m.leadAttorneyEmail ? <div>Attorney: {m.leadAttorneyEmail}</div> : null}
        {value ? <div style={{ color: "inherit", fontWeight: 900 }}>{value}</div> : null}
      </div>
    </Link>
  );
}

function AddMatterModal({
  pipelineId,
  stageId,
  onClose,
  onAdded,
}: {
  pipelineId: string;
  stageId: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Matter[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/available-matters?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.error || "Failed");
      setResults(data.matters || []);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function add(matterId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/matters`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matterId, stageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || "Failed");
      onAdded();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 60,
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          borderRadius: 14,
          border: "1px solid var(--sw-border, rgba(0,0,0,0.12))",
          background: "var(--sw-surface)",
          color: "var(--sw-text)",
          padding: 16,
          boxShadow: "var(--sw-shadow)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Add matter to pipeline</div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--sw-border)",
              background: "transparent",
              color: "inherit",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search matters by name…"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          />
          <button
            onClick={search}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.04)",
              color: "inherit",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>

        {error ? <div style={{ marginTop: 10, color: "var(--sw-danger)" }}>{error}</div> : null}

        <div style={{ marginTop: 12, display: "grid", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
          {results.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--sw-border)",
                background: "rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900 }}>{m.displayName}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--sw-muted)" }}>
                  {m.primaryPhone || ""} {m.primaryEmail ? `• ${m.primaryEmail}` : ""}
                </div>
              </div>
              <button
                onClick={() => add(m.id)}
                disabled={busy}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid rgba(110,231,255,0.45)",
                  background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
                  fontWeight: 900,
                  color: "inherit",
                  cursor: "pointer",
                  flex: "0 0 auto",
                }}
              >
                Add
              </button>
            </div>
          ))}
          {results.length === 0 ? (
            <div style={{ color: "var(--sw-muted)", fontSize: 12 }}>
              Search to find matters not already in this pipeline.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
