"use client";

import { useState } from "react";

type Feature = {
  id: string;
  key: string;
  label: string;
  group: string | null;
  type: "MONEY" | "TEXT" | "BOOLEAN" | "NUMBER";
  moneyCents: number | null;
  textValue: string | null;
  boolValue: boolean | null;
  numberValue: number | null;
  description: string | null;
  active: boolean;
};

function fmtMoney(cents: number) {
  return (cents / 100).toFixed(2);
}

export function PricingClient({ initialFeatures, canEdit }: { initialFeatures: any[]; canEdit: boolean }) {
  const features: Feature[] = initialFeatures || [];

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newF, setNewF] = useState({ key: "", label: "", group: "", type: "MONEY" as Feature["type"], money: "0" });

  async function patch(id: string, patch: any) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pricing/features/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const moneyCents = Math.round(Number(newF.money) * 100);
      const res = await fetch(`/api/pricing/features`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: newF.key,
          label: newF.label,
          group: newF.group || null,
          type: newF.type,
          moneyCents,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      {canEdit ? (
        <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Add feature</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <input className="sw-input" placeholder="key (snake_case)" value={newF.key} onChange={(e) => setNewF((s) => ({ ...s, key: e.target.value }))} />
            <input className="sw-input" placeholder="Label" value={newF.label} onChange={(e) => setNewF((s) => ({ ...s, label: e.target.value }))} />
            <input className="sw-input" placeholder="Group (optional)" value={newF.group} onChange={(e) => setNewF((s) => ({ ...s, group: e.target.value }))} />
            <select className="sw-input" value={newF.type} onChange={(e) => setNewF((s) => ({ ...s, type: e.target.value as any }))}>
              <option value="MONEY">MONEY</option>
              <option value="TEXT">TEXT</option>
              <option value="BOOLEAN">BOOLEAN</option>
              <option value="NUMBER">NUMBER</option>
            </select>
            <input className="sw-input" placeholder="Money (USD)" value={newF.money} onChange={(e) => setNewF((s) => ({ ...s, money: e.target.value }))} />
          </div>
          <button className="sw-btn sw-btnPrimary" onClick={create} disabled={busy || !newF.key || !newF.label}>
            Create
          </button>
          {error ? <div style={{ color: "var(--sw-danger)" }}>{error}</div> : null}
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="sw-table">
          <thead>
            <tr>
              <th className="sw-th">Key</th>
              <th className="sw-th">Label</th>
              <th className="sw-th">Group</th>
              <th className="sw-th">Type</th>
              <th className="sw-th">Value</th>
              <th className="sw-th">Active</th>
            </tr>
          </thead>
          <tbody>
            {features.map((f) => (
              <tr key={f.id} className="sw-tr">
                <td className="sw-td" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>
                  {f.key}
                </td>
                <td className="sw-td">{f.label}</td>
                <td className="sw-td">{f.group || ""}</td>
                <td className="sw-td">{f.type}</td>
                <td className="sw-td">
                  {f.type === "MONEY" ? (
                    <input
                      className="sw-input"
                      style={{ width: 120 }}
                      disabled={!canEdit}
                      defaultValue={fmtMoney(f.moneyCents || 0)}
                      onBlur={(e) => patch(f.id, { moneyCents: Math.round(Number(e.target.value) * 100) })}
                    />
                  ) : f.type === "TEXT" ? (
                    <input
                      className="sw-input"
                      disabled={!canEdit}
                      defaultValue={f.textValue || ""}
                      onBlur={(e) => patch(f.id, { textValue: e.target.value })}
                    />
                  ) : f.type === "BOOLEAN" ? (
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      defaultChecked={!!f.boolValue}
                      onChange={(e) => patch(f.id, { boolValue: e.target.checked })}
                    />
                  ) : (
                    <input
                      className="sw-input"
                      style={{ width: 120 }}
                      disabled={!canEdit}
                      defaultValue={f.numberValue ?? 0}
                      onBlur={(e) => patch(f.id, { numberValue: Number(e.target.value) })}
                    />
                  )}
                </td>
                <td className="sw-td">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    defaultChecked={f.active}
                    onChange={(e) => patch(f.id, { active: e.target.checked })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canEdit ? <div className="sw-muted">Admin-only edit.</div> : null}
    </div>
  );
}
