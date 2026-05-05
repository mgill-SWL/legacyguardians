"use client";

import { FormEvent, useState } from "react";

type ImportResponse = {
  ok?: boolean;
  error?: string;
  importBatchId?: string;
  importedRows?: number;
  feeIncomeTotalUsd?: number;
  reimbursedDirectTotalUsd?: number;
  reimbursedIndirectTotalUsd?: number;
  accountTotals?: Array<{ account: string; amountUsd: number }>;
};

export default function InvoicePaymentAllocationsImportPage() {
  const [detailFile, setDetailFile] = useState<File | null>(null);
  const [transactionsFile, setTransactionsFile] = useState<File | null>(null);
  const [accountsFile, setAccountsFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    if (!detailFile || !transactionsFile || !accountsFile) {
      setError("Please attach the detail, transactions, and account-summary CSV sheets.");
      setSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.set("detailFile", detailFile);
    formData.set("transactionsFile", transactionsFile);
    formData.set("accountsFile", accountsFile);

    const response = await fetch("/api/admin/imports/invoice-payment-allocations", {
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
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 30 }}>Invoice Payment Allocations import</h1>
      <p style={{ marginTop: 10, color: "var(--sw-muted)" }}>
        Import the CosmoLex Invoice Payment Allocations report. For now, use the exported CSVs for:
        <strong> detail</strong>, <strong>transaction summary</strong>, and <strong>account summary</strong>.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 24, display: "grid", gap: 18 }}>
        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Sheet 1 — Detail CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setDetailFile(e.target.files?.[0] ?? null)} />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Sheet 3 — Summary of Invoice Applied Transactions CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setTransactionsFile(e.target.files?.[0] ?? null)} />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>Sheet 4 — Summary By Account CSV</span>
          <input type="file" accept=".csv,text/csv" onChange={(e) => setAccountsFile(e.target.files?.[0] ?? null)} />
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
          {submitting ? "Importing…" : "Import invoice payment allocations"}
        </button>
      </form>

      {error ? <div style={{ marginTop: 20, color: "#ffb3c1" }}>{error}</div> : null}

      {result?.ok ? (
        <section style={{ marginTop: 24, padding: 16, borderRadius: 14, border: "1px solid var(--sw-border)", background: "var(--sw-card)" }}>
          <h2 style={{ marginTop: 0 }}>Import complete</h2>
          <ul style={{ lineHeight: 1.7 }}>
            <li>Import batch: {result.importBatchId}</li>
            <li>Applied rows imported: {result.importedRows}</li>
            <li>4100 fee income total: ${result.feeIncomeTotalUsd?.toFixed(2)}</li>
            <li>4200 reimbursed direct total: ${result.reimbursedDirectTotalUsd?.toFixed(2)}</li>
            <li>4250 reimbursed indirect total: ${result.reimbursedIndirectTotalUsd?.toFixed(2)}</li>
          </ul>
          {result.accountTotals?.length ? (
            <div>
              <h3>Account totals from sheet 4</h3>
              <ul>
                {result.accountTotals.map((row) => (
                  <li key={row.account}>
                    {row.account}: ${row.amountUsd.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
