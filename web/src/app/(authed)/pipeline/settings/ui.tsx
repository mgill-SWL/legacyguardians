"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stage = { id: string; name: string; sortOrder: number; colorHex: string | null };
type Pipe = { id: string; name: string; description: string | null; sortOrder: number; stages: Stage[] };

async function api(path: string, init: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function PipelineSettingsClient({ pipelines }: { pipelines: Pipe[] }) {
  const router = useRouter();
  const [newPipelineName, setNewPipelineName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createPipeline() {
    if (!newPipelineName.trim()) return;
    setBusy("createPipeline");
    setError(null);
    try {
      await api("/api/pipelines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newPipelineName.trim() }),
      });
      setNewPipelineName("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function addStage(pipelineId: string, name: string) {
    setBusy(`addStage:${pipelineId}`);
    setError(null);
    try {
      await api(`/api/pipelines/${pipelineId}/stages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function moveStage(stageId: string, dir: "up" | "down") {
    setBusy(`move:${stageId}`);
    setError(null);
    try {
      await api(`/api/stages/${stageId}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dir }),
      });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function patchStage(stageId: string, patch: { name?: string; colorHex?: string | null }) {
    setBusy(`patch:${stageId}`);
    setError(null);
    try {
      await api(`/api/stages/${stageId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function deleteStage(stageId: string) {
    if (!confirm("Delete this stage?")) return;
    setBusy(`del:${stageId}`);
    setError(null);
    try {
      await api(`/api/stages/${stageId}`, { method: "DELETE" });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function renamePipeline(pipelineId: string, name: string) {
    setBusy(`rename:${pipelineId}`);
    setError(null);
    try {
      await api(`/api/pipelines/${pipelineId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function deletePipeline(pipelineId: string) {
    if (!confirm("Delete this pipeline and all its stages?")) return;
    setBusy(`delpipe:${pipelineId}`);
    setError(null);
    try {
      await api(`/api/pipelines/${pipelineId}`, { method: "DELETE" });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function importLawmatics() {
    if (!confirm("Import the Lawmatics pipelines/stages from the screenshots?")) return;
    setBusy("importLawmatics");
    setError(null);
    try {
      await api("/api/pipelines/import-lawmatics", { method: "POST" });
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
          borderRadius: 14,
          padding: 16,
          background: "rgba(255,255,255,0.03)",
          maxWidth: 760,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Add pipeline</div>
          <button
            onClick={importLawmatics}
            disabled={busy === "importLawmatics"}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "transparent",
              color: "inherit",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Import Lawmatics pipelines
          </button>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <input
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            placeholder="e.g., Estate Planning Representation"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              color: "inherit",
            }}
          />
          <button
            onClick={createPipeline}
            disabled={busy === "createPipeline" || !newPipelineName.trim()}
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
            Add
          </button>
        </div>
        {error ? <div style={{ marginTop: 10, color: "#ffb4b4" }}>{error}</div> : null}
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
        {pipelines.map((p) => (
          <PipelineCard
            key={p.id}
            pipeline={p}
            busy={busy}
            onAddStage={addStage}
            onMoveStage={moveStage}
            onPatchStage={patchStage}
            onDeleteStage={deleteStage}
            onRename={renamePipeline}
            onDeletePipeline={deletePipeline}
          />
        ))}

        {pipelines.length === 0 ? (
          <div style={{ color: "var(--sw-muted, #aab4d4)" }}>No pipelines yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function PipelineCard({
  pipeline,
  busy,
  onAddStage,
  onMoveStage,
  onPatchStage,
  onDeleteStage,
  onRename,
  onDeletePipeline,
}: {
  pipeline: Pipe;
  busy: string | null;
  onAddStage: (pipelineId: string, name: string) => Promise<void>;
  onMoveStage: (stageId: string, dir: "up" | "down") => Promise<void>;
  onPatchStage: (stageId: string, patch: { name?: string; colorHex?: string | null }) => Promise<void>;
  onDeleteStage: (stageId: string) => Promise<void>;
  onRename: (pipelineId: string, name: string) => Promise<void>;
  onDeletePipeline: (pipelineId: string) => Promise<void>;
}) {
  const [stageName, setStageName] = useState("");
  const [name, setName] = useState(pipeline.name);
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
        borderRadius: 14,
        padding: 16,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 900,
            background: "transparent",
            color: "inherit",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
          title={open ? "Collapse" : "Expand"}
        >
          <span style={{ opacity: 0.8 }}>{open ? "▾" : "▸"}</span>
          <span>{pipeline.name}</span>
        </button>
        <button
          onClick={() => onDeletePipeline(pipeline.id)}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "inherit",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Delete pipeline
        </button>
      </div>

      {open ? (
        <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
                color: "inherit",
              }}
            />
            <button
              onClick={() => onRename(pipeline.id, name)}
              disabled={name.trim() === pipeline.name}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Rename
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {pipeline.stages.map((s, idx) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.12)",
                }}
              >
                <div style={{ fontWeight: 800 }}>{s.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={s.colorHex || "#6ee7ff"}
                    onChange={(e) => onPatchStage(s.id, { colorHex: e.target.value })}
                    title="Stage color"
                    style={{ width: 28, height: 24, background: "transparent", border: "none", padding: 0 }}
                  />
                  <button disabled={idx === 0} onClick={() => onMoveStage(s.id, "up")} style={miniBtn}>
                    ↑
                  </button>
                  <button
                    disabled={idx === pipeline.stages.length - 1}
                    onClick={() => onMoveStage(s.id, "down")}
                    style={miniBtn}
                  >
                    ↓
                  </button>
                  <button onClick={() => onDeleteStage(s.id)} style={miniBtn}>
                    ✕
                  </button>
                </div>
              </div>
            ))}

            {pipeline.stages.length === 0 ? (
              <div style={{ color: "var(--sw-muted, #aab4d4)", fontSize: 12 }}>No stages yet.</div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
              placeholder="Add stage…"
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
                color: "inherit",
              }}
            />
            <button
              onClick={() => {
                const v = stageName.trim();
                if (!v) return;
                setStageName("");
                onAddStage(pipeline.id, v);
              }}
              disabled={!stageName.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Add stage
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
            Reorder with ↑/↓. Stage colors show in the Kanban view.
          </div>
        </div>
      ) : null}
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "transparent",
  color: "inherit",
  fontWeight: 900,
  cursor: "pointer",
};
