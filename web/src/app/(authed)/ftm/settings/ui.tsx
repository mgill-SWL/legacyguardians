"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: string; email: string | null; name: string | null };
type Step = {
  id: string;
  name: string;
  sortOrder: number;
  howOwnerUserId: string | null;
  ensureOwnerUserId: string | null;
  doerUserId: string | null;
  doerRole: string | null;
};
type Map = { id: string; title: string; description: string | null; steps: Step[] };

async function api(path: string, init: RequestInit) {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function FtmSettingsClient({ maps, users }: { maps: Map[]; users: User[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createMap() {
    setError(null);
    if (!title.trim()) return;
    await api("/api/ftm/maps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setTitle("");
    router.refresh();
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
      <div
        style={{
          border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
          borderRadius: 14,
          padding: 16,
          background: "rgba(255,255,255,0.03)",
          maxWidth: 760,
        }}
      >
        <div style={{ fontWeight: 900 }}>Add task map</div>
        <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Estate Admin: Opening & Qualification"
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
            onClick={createMap}
            disabled={!title.trim()}
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

      {maps.map((m) => (
        <MapCard key={m.id} map={m} users={users} onChanged={() => router.refresh()} />
      ))}

      {maps.length === 0 ? (
        <div style={{ color: "var(--sw-muted, #aab4d4)" }}>No task maps yet.</div>
      ) : null}
    </div>
  );
}

function MapCard({ map, users, onChanged }: { map: Map; users: User[]; onChanged: () => void }) {
  const [stepName, setStepName] = useState("");

  async function addStep() {
    const v = stepName.trim();
    if (!v) return;
    setStepName("");
    await api(`/api/ftm/maps/${map.id}/steps`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: v }),
    });
    onChanged();
  }

  async function updateStep(stepId: string, patch: any) {
    await api(`/api/ftm/steps/${stepId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    onChanged();
  }

  async function moveStep(stepId: string, dir: "up" | "down") {
    await api(`/api/ftm/steps/${stepId}/move`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dir }),
    });
    onChanged();
  }

  return (
    <div
      style={{
        border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
        borderRadius: 14,
        padding: 16,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ fontWeight: 900 }}>{map.title}</div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {map.steps.map((s, idx) => (
          <div
            key={s.id}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(0,0,0,0.12)",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>{s.name}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={idx === 0} onClick={() => moveStep(s.id, "up")} style={miniBtn}>
                  ↑
                </button>
                <button disabled={idx === map.steps.length - 1} onClick={() => moveStep(s.id, "down")} style={miniBtn}>
                  ↓
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>How owner</span>
                <select
                  value={s.howOwnerUserId || ""}
                  onChange={(e) => updateStep(s.id, { howOwnerUserId: e.target.value || null })}
                  style={selectStyle}
                >
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} style={{ color: "#000" }}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>Ensure owner</span>
                <select
                  value={s.ensureOwnerUserId || ""}
                  onChange={(e) => updateStep(s.id, { ensureOwnerUserId: e.target.value || null })}
                  style={selectStyle}
                >
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} style={{ color: "#000" }}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>Doer</span>
                <select
                  value={s.doerUserId || ""}
                  onChange={(e) => updateStep(s.id, { doerUserId: e.target.value || null })}
                  style={selectStyle}
                >
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} style={{ color: "#000" }}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={stepName}
            onChange={(e) => setStepName(e.target.value)}
            placeholder="Add step…"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.03)",
              color: "inherit",
            }}
          />
          <button onClick={addStep} disabled={!stepName.trim()} style={addBtn}>
            Add step
          </button>
        </div>
      </div>
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

const addBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  fontWeight: 900,
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  padding: "10px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
};
