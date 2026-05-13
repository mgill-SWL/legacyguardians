"use client";

import { FormEvent, useState } from "react";

type Result = { ok?: boolean; error?: string; created?: number; updated?: number };

export function CoaImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    setError(null);
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/accounting/coa/import", { method: "POST", body: fd });
      const json = (await res.json().catch(() => ({}))) as Result;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sw-card sw-card-pad" style={{ display: "grid", gap: 12, maxWidth: 860 }}>
      <div style={{ fontWeight: 900 }}>Import chart of accounts (CSV)</div>
      <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button className="sw-btn sw-btnPrimary" type="submit" disabled={busy} style={{ width: "fit-content" }}>
        {busy ? "Importing…" : "Import COA"}
      </button>
      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}
      {result?.ok ? (
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Imported. Created {result.created} · Updated {result.updated}
        </div>
      ) : null}
    </form>
  );
}

