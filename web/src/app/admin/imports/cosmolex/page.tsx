"use client";

import { FormEvent, useState } from "react";

type ImportResponse = {
  ok?: boolean;
  error?: string;
  collectionsBatchId?: string;
  billingsBatchId?: string;
  collectionsRows?: number;
  billingsRows?: number;
  collectionsRange?: [string | null, string | null];
  billingsRange?: [string | null, string | null];
};

export default function CosmolexImportPage() {
  const [collectionsFile, setCollectionsFile] = useState<File | null>(null);
  const [billingsFile, setBillingsFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    if (!collectionsFile || !billingsFile) {
      setSubmitting(false);
      setError("Please attach both the collections CSV and billings CSV.");
      return;
    }

    const formData = new FormData();
    formData.set("collectionsFile", collectionsFile);
    formData.set("billingsFile", billingsFile);

    const response = await fetch("/api/admin/imports/cosmolex", {
      method: "POST",
      body: formData,
    });

    const json = (await response.json()) as ImportResponse;

    if (!response.ok) {
      setError(json.error ?? "Import failed");
      setSubmitting(false);
      return;
    }

    setResult(json);
    setSubmitting(false);
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 30 }}>CosmoLex KPI import</h1>
      <p style={{ marginTop: 10, color: "var(--sw-muted)" }}>
        Upload the weekly <strong>Collections by Timekeeper</strong> and <strong>Billings by Timekeeper</strong> CSVs.
        This writes import batches and matter financial events into the database for downstream KPI reporting.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 24, display: "grid", gap: 18 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Collections by Timekeeper (CSV)</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setCollectionsFile(e.target.files?.[0] ?? null)} />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Billings by Timekeeper (CSV)</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setBillingsFile(e.target.files?.[0] ?? null)} />
        </label>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "fit-content",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(110,231,255,0.45)",
            background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
            fontWeight: 700,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Importing…" : "Import CosmoLex reports"}
        </button>
      </form>

      {error ? (
        <div style={{ marginTop: 20, padding: 12, borderRadius: 10, border: "1px solid rgba(255,99,132,0.4)", color: "#ffb3c1" }}>
          {error}
        </div>
      ) : null}

      {result?.ok ? (
        <section style={{ marginTop: 24, padding: 16, borderRadius: 14, border: "1px solid var(--sw-border)", background: "var(--sw-card)" }}>
          <h2 style={{ marginTop: 0 }}>Import complete</h2>
          <ul style={{ lineHeight: 1.7 }}>
            <li>Collections rows imported: {result.collectionsRows}</li>
            <li>Billings rows imported: {result.billingsRows}</li>
            <li>Collections batch: {result.collectionsBatchId}</li>
            <li>Billings batch: {result.billingsBatchId}</li>
            <li>Collections range: {result.collectionsRange?.[0] ?? "?"} → {result.collectionsRange?.[1] ?? "?"}</li>
            <li>Billings range: {result.billingsRange?.[0] ?? "?"} → {result.billingsRange?.[1] ?? "?"}</li>
          </ul>
          <p style={{ color: "var(--sw-muted)", marginBottom: 0 }}>
            Next step: reconcile imported financial events to matters where needed, then compute DB-backed KPI snapshots.
          </p>
        </section>
      ) : null}
    </main>
  );
}
