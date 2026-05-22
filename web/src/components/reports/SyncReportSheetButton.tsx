"use client";

import { useState } from "react";

type SyncResponse = {
  ok?: boolean;
  error?: string;
  sheetName?: string;
  totalSheetRows?: number;
  created?: number;
  updated?: number;
};

export function SyncReportSheetButton({ endpoint }: { endpoint: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as SyncResponse;
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg(`Synced ${data.totalSheetRows ?? 0} rows from ${data.sheetName ?? "sheet"} (created ${data.created ?? 0}, updated ${data.updated ?? 0}).`);
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
        {busy ? "Syncing..." : "Sync from Google Sheet"}
      </button>
      {msg ? (
        <div className="sw-muted" style={{ fontSize: 12 }}>
          {msg}
        </div>
      ) : null}
    </div>
  );
}
