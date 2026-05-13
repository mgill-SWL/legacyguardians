"use client";

import { FormEvent, useState } from "react";

type Result = { ok?: boolean; error?: string; batchId?: string; parsedRows?: number; insertedRows?: number };

export function BookkeepingInboxClient() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

      const res = await fetch("/api/accounting/import/chase-card", { method: "POST", body: formData });
      const json = (await res.json().catch(() => ({}))) as Result;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Bookkeeping inbox</h1>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          CSV ingest (MVP)
        </div>
      </div>

      <p className="sw-muted" style={{ marginTop: 8, maxWidth: 860 }}>
        Upload raw bank/card activity CSVs and LG will ingest them into a review queue (raw transactions → bookkeeping classifications).
        Right now, the supported format is <b>Chase credit card activity CSV</b>.
      </p>

      <form onSubmit={onSubmit} className="sw-card sw-card-pad" style={{ marginTop: 14, maxWidth: 860, display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 900 }}>Upload</div>
        <label style={{ display: "grid", gap: 8 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Chase credit card CSV
          </span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>

        <button className="sw-btn sw-btnPrimary" type="submit" disabled={submitting} style={{ width: "fit-content" }}>
          {submitting ? "Uploading…" : "Upload CSV"}
        </button>

        {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}

        {result?.ok ? (
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Imported. Parsed rows: <b>{result.parsedRows}</b> · Inserted: <b>{result.insertedRows}</b> · Batch: <b>{result.batchId}</b>
          </div>
        ) : null}
      </form>

      <div className="sw-muted" style={{ marginTop: 12, fontSize: 12, maxWidth: 860 }}>
        Next: operating bank CSV support (need one sample export), and the actual review/triage queue UI.
      </div>
    </div>
  );
}

