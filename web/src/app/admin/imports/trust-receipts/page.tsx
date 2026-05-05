"use client";

import { FormEvent, useState } from "react";

type ImportResponse = {
  ok?: boolean;
  error?: string;
  importBatchId?: string;
  importedRows?: number;
  amountTotalUsd?: number;
};

export default function TrustReceiptsImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    if (!file) {
      setError("Please attach the Trust Receipts Journal CSV.");
      setSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch("/api/admin/imports/trust-receipts", { method: "POST", body: formData });
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
      <h1 style={{ margin: 0, fontSize: 30 }}>Trust Receipts Journal import</h1>
      <p style={{ marginTop: 10, color: "var(--sw-muted)" }}>
        Import the Trust Receipts Journal CSV to create trust-deposit financial events.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 24, display: "grid", gap: 18 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Trust Receipts Journal CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <button type="submit" disabled={submitting} style={{ width: "fit-content", padding: "10px 14px", borderRadius: 10 }}>
          {submitting ? "Importing…" : "Import trust receipts"}
        </button>
      </form>

      {error ? <div style={{ marginTop: 20, color: "#ffb3c1" }}>{error}</div> : null}
      {result?.ok ? (
        <div style={{ marginTop: 24 }}>
          Imported {result.importedRows} rows (${result.amountTotalUsd?.toFixed(2)}) in batch {result.importBatchId}.
        </div>
      ) : null}
    </main>
  );
}
