"use client";

import Link from "next/link";
import { useState } from "react";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  subtotalCents: number;
  totalCents: number;
  createdAt: string;
};

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function BillingCard({ matterId, invoices }: { matterId: string; invoices: InvoiceRow[] }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createDraft() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/invoices/draft-from-timecards`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: "var(--sw-radius)",
        background: "var(--sw-card)",
        border: "1px solid var(--sw-border)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Billing</div>
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Draft invoices are generated from billable timecards (hourly + flat-fee entries).
          </div>
        </div>
        <button className="sw-btn" onClick={createDraft} disabled={submitting}>
          {submitting ? "Creating…" : "Create draft invoice from timecards"}
        </button>
      </div>

      {error ? <div style={{ marginTop: 10, color: "#ffb3c1" }}>{error}</div> : null}

      <div style={{ marginTop: 14 }}>
        {invoices.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/matters/${matterId}/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                  </td>
                  <td>{inv.status}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(inv.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sw-muted">No invoices yet.</div>
        )}
      </div>
    </section>
  );
}
