"use client";

import { FormEvent, useState } from "react";

type Result = { ok?: boolean; error?: string; suggestions?: number; created?: number; updated?: number };

export function ImportPayeeRulesFromGlClient() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Choose a General Ledger .xlsx first.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/accounting/payee-rules/import-gl", { method: "POST", body: fd });
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
    <form onSubmit={onSubmit} className="sw-card sw-card-pad" style={{ display: "grid", gap: 12, maxWidth: 980 }}>
      <div style={{ fontWeight: 900 }}>Generate starter rules from General Ledger (XLSX)</div>
      <div className="sw-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
        This reads your GL and creates <b>CONTAINS</b> rules for common payees, mapped to the most frequent expense account.
      </div>
      <input
        className="sw-file"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button className="sw-btn sw-btnPrimary" type="submit" disabled={busy} style={{ width: "fit-content" }}>
        {busy ? "Generating…" : "Generate rules"}
      </button>
      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}
      {result?.ok ? (
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Suggestions: {result.suggestions} · Created {result.created} · Updated {result.updated}
        </div>
      ) : null}
    </form>
  );
}
