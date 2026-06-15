"use client";

import { useState } from "react";

export function SyncFromSheetButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reports/intake-reporting/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg(`Synced ${data.totalSheetRows} rows (created ${data.created}, updated ${data.updated}).`);
      window.location.reload();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button className="sw-btn" onClick={sync} disabled={busy}>
        {busy ? "Syncing…" : "Sync from Google Sheet"}
      </button>
      {msg ? (
        <div className="sw-muted" style={{ fontSize: 12 }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}

