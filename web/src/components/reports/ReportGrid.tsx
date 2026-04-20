"use client";

import { useMemo, useState } from "react";

type Column = {
  id: string;
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "CURRENCY" | "PERCENT" | "DATE";
  sortOrder: number;
};

type Row = {
  id: string;
  rowKey: string;
  label: string;
  sortOrder: number;
  data: any;
};

type Table = {
  id: string;
  slug: string;
  name: string;
  columns: Column[];
  rows: Row[];
};

export function ReportGrid({
  table,
  canAdmin,
}: {
  table: Table;
  canAdmin: boolean;
}) {
  const [q, setQ] = useState("");
  const [addingCol, setAddingCol] = useState(false);
  const [newCol, setNewCol] = useState({ key: "", label: "", type: "NUMBER" as Column["type"] });
  const [rowLabel, setRowLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(() => [...table.columns].sort((a, b) => a.sortOrder - b.sortOrder), [table.columns]);
  const rows = useMemo(() => {
    const rr = [...table.rows].sort((a, b) => a.sortOrder - b.sortOrder);
    const qq = q.trim().toLowerCase();
    if (!qq) return rr;
    return rr.filter((r) => r.label.toLowerCase().includes(qq));
  }, [table.rows, q]);

  async function patchCell(rowId: string, key: string, value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${table.slug}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function addRow() {
    const label = rowLabel.trim();
    if (!label) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${table.slug}/rows`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
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

  async function addColumn() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${table.slug}/columns`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newCol),
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

  async function deleteColumn(colId: string) {
    if (!confirm("Delete this column?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/columns/${colId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input className="sw-input" placeholder="Filter rows…" value={q} onChange={(e) => setQ(e.target.value)} />
        <input
          className="sw-input"
          placeholder="Add row label (e.g., 2026-04 Wk 3)"
          value={rowLabel}
          onChange={(e) => setRowLabel(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <button className="sw-btn sw-btnPrimary" onClick={addRow} disabled={busy}>
          Add row
        </button>
        {canAdmin ? (
          <button className="sw-btn" onClick={() => setAddingCol((v) => !v)}>
            {addingCol ? "Close column editor" : "Add column"}
          </button>
        ) : null}
        {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}
      </div>

      {addingCol && canAdmin ? (
        <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>New column</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="sw-input"
              placeholder="key (snake_case)"
              value={newCol.key}
              onChange={(e) => setNewCol((c) => ({ ...c, key: e.target.value }))}
            />
            <input
              className="sw-input"
              placeholder="Label"
              value={newCol.label}
              onChange={(e) => setNewCol((c) => ({ ...c, label: e.target.value }))}
              style={{ minWidth: 260 }}
            />
            <select
              className="sw-input"
              value={newCol.type}
              onChange={(e) => setNewCol((c) => ({ ...c, type: e.target.value as any }))}
            >
              <option value="TEXT">Text</option>
              <option value="NUMBER">Number</option>
              <option value="CURRENCY">Currency</option>
              <option value="PERCENT">Percent</option>
              <option value="DATE">Date</option>
            </select>
            <button className="sw-btn sw-btnPrimary" onClick={addColumn} disabled={busy || !newCol.key || !newCol.label}>
              Create column
            </button>
          </div>
          <div style={{ fontSize: 12 }} className="sw-muted">
            Column delete is restricted (super-admin only).
          </div>
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <table className="sw-table">
          <thead>
            <tr>
              <th className="sw-th">Row</th>
              {columns.map((c) => (
                <th key={c.id} className="sw-th">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <span>{c.label}</span>
                    {canAdmin ? (
                      <button className="sw-btn sw-btnGhost sw-btnSm" onClick={() => deleteColumn(c.id)}>
                        ✕
                      </button>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="sw-tr">
                <td className="sw-td" style={{ fontWeight: 900, whiteSpace: "nowrap" }}>
                  {r.label}
                </td>
                {columns.map((c) => (
                  <td key={c.id} className="sw-td">
                    <input
                      className="sw-input"
                      defaultValue={r.data?.[c.key] ?? ""}
                      onBlur={(e) => patchCell(r.id, c.key, e.target.value)}
                      style={{ width: 120 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 ? <div className="sw-muted" style={{ marginTop: 12 }}>No rows yet.</div> : null}
      </div>
    </div>
  );
}
