"use client";

import { useState } from "react";

type InvoiceHeader = {
  id: string;
  matterId: string;
  invoiceNumber: string;
  status: string;
  subtotalCents: number;
  totalCents: number;
  allocatedTotalCents: number;
  outstandingCents: number;
  issueDate: string | null;
  dueDate: string | null;
};

type Line = {
  id: string;
  lineType: "FEE" | "ADVANCED_CLIENT_COST";
  description: string;
  quantityTenths: number;
  unitPriceCents: number;
  amountCents: number;
  sortOrder: number;
  timeEntryId: string | null;
  allocatedCents: number;
  remainingCents: number;
};

type PaymentRow = {
  paymentId: string;
  receivedAt: string;
  method: string;
  direction: string;
  payerName: string | null;
  reference: string | null;
  amountCents: number;
  appliedCents: number;
};

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function InvoiceClient({ invoice, lines, payments }: { invoice: InvoiceHeader; lines: Line[]; payments: PaymentRow[] }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newCostDesc, setNewCostDesc] = useState("");
  const [newCostAmountUsd, setNewCostAmountUsd] = useState("");

  const [payAmountUsd, setPayAmountUsd] = useState("");
  const [payMethod, setPayMethod] = useState<"CHECK" | "ACH" | "WIRE" | "CASH" | "CARD" | "OTHER">("OTHER");
  const [payPayer, setPayPayer] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const [issueDate, setIssueDate] = useState(invoice.issueDate || new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice.dueDate || "");

  async function addAdvancedCost() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/lines`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lineType: "ADVANCED_CLIENT_COST",
          description: newCostDesc,
          amountUsd: newCostAmountUsd,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteLine(lineId: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/lines/${lineId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function recordPayment() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          receivedDate: payDate,
          amountUsd: payAmountUsd,
          method: payMethod,
          payerName: payPayer,
          reference: payRef,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  const [refundAmountUsd, setRefundAmountUsd] = useState("");
  const [refundDate, setRefundDate] = useState(new Date().toISOString().slice(0, 10));
  const [refundReason, setRefundReason] = useState<"REFUND" | "CHARGEBACK">("REFUND");
  const [refundRef, setRefundRef] = useState("");

  async function recordRefund() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/refunds`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          refundDate,
          amountUsd: refundAmountUsd,
          reason: refundReason,
          method: "OTHER",
          reference: refundRef,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function issueInvoice() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/issue`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueDate, dueDate: dueDate || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
      {error ? <div style={{ color: "#ffb3c1" }}>{error}</div> : null}

      <div className="sw-card sw-card-pad">
        <div style={{ fontWeight: 900 }}>Issue invoice</div>
        <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
          Issued invoices show up in A/R aging. (You can still post payments to drafts, but issuing keeps workflow clean.)
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Issue date
            </span>
            <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} disabled={invoice.status !== "DRAFT"} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Due date (optional)
            </span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={invoice.status !== "DRAFT"} />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="sw-btn" disabled={submitting || invoice.status !== "DRAFT"} onClick={issueInvoice}>
              {submitting ? "Issuing…" : "Issue invoice"}
            </button>
          </div>
        </div>
      </div>

      <div className="sw-card sw-card-pad">
        <div style={{ fontWeight: 900 }}>Invoice lines</div>
        <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
          Advanced client costs are excluded from the MSO split base and are allocated first when payments are recorded.
        </div>

        <div style={{ marginTop: 12 }}>
          <table className="sw-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Description</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th style={{ textAlign: "right" }}>Allocated</th>
                <th style={{ textAlign: "right" }}>Remaining</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.lineType}</td>
                  <td style={{ maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.description}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(l.amountCents)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(l.allocatedCents)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(l.remainingCents)}</td>
                  <td style={{ textAlign: "right" }}>
                    {!l.timeEntryId && invoice.status === "DRAFT" ? (
                      <button className="sw-btn" disabled={submitting || l.allocatedCents > 0} onClick={() => deleteLine(l.id)}>
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invoice.status === "DRAFT" ? (
          <div style={{ marginTop: 14, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Advanced cost description
              </span>
              <input value={newCostDesc} onChange={(e) => setNewCostDesc(e.target.value)} placeholder="e.g., Deed recording" />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Amount (USD)
              </span>
              <input value={newCostAmountUsd} onChange={(e) => setNewCostAmountUsd(e.target.value)} placeholder="e.g., 33" />
            </label>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button className="sw-btn" disabled={submitting || !newCostDesc.trim() || !newCostAmountUsd.trim()} onClick={addAdvancedCost}>
                {submitting ? "Saving…" : "Add advanced cost"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="sw-card sw-card-pad">
        <div style={{ fontWeight: 900 }}>Record payment</div>
        <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
          Default allocation: advanced client costs first, then fees.
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Date received
            </span>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Amount (USD)
            </span>
            <input value={payAmountUsd} onChange={(e) => setPayAmountUsd(e.target.value)} placeholder="e.g., 500" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Method
            </span>
            <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as "CHECK" | "ACH" | "WIRE" | "CASH" | "CARD" | "OTHER")}>
              <option value="CHECK">Check</option>
              <option value="ACH">ACH</option>
              <option value="WIRE">Wire</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Payer
            </span>
            <input value={payPayer} onChange={(e) => setPayPayer(e.target.value)} placeholder="optional" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Reference
            </span>
            <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="check # / transaction id" />
          </label>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="sw-btn" disabled={submitting || !payAmountUsd.trim()} onClick={recordPayment}>
              {submitting ? "Posting…" : `Post payment (outstanding ${usd(invoice.outstandingCents)})`}
            </button>
          </div>
        </div>
      </div>

      <div className="sw-card sw-card-pad">
        <div style={{ fontWeight: 900 }}>Payments</div>
        <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
          Payments posted against this invoice.
        </div>
        <div style={{ marginTop: 12 }}>
          {payments.length ? (
            <table className="sw-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dir</th>
                  <th>Method</th>
                  <th>Payer</th>
                  <th>Reference</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th style={{ textAlign: "right" }}>Applied</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td>{p.receivedAt}</td>
                    <td>{p.direction}</td>
                    <td>{p.method}</td>
                    <td>{p.payerName || "—"}</td>
                    <td>{p.reference || "—"}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(p.amountCents)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(p.appliedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="sw-muted">No payments yet.</div>
          )}
        </div>
      </div>

      <div className="sw-card sw-card-pad">
        <div style={{ fontWeight: 900 }}>Refund / chargeback</div>
        <div className="sw-muted" style={{ marginTop: 6, fontSize: 12 }}>
          This posts an outflow payment and applies a negative allocation to reverse prior allocations (fees first).
        </div>
        <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Date
            </span>
            <input type="date" value={refundDate} onChange={(e) => setRefundDate(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Type
            </span>
            <select value={refundReason} onChange={(e) => setRefundReason(e.target.value as "REFUND" | "CHARGEBACK")}>
              <option value="REFUND">Refund</option>
              <option value="CHARGEBACK">Chargeback</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Amount (USD)
            </span>
            <input value={refundAmountUsd} onChange={(e) => setRefundAmountUsd(e.target.value)} placeholder="e.g., 250" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Reference
            </span>
            <input value={refundRef} onChange={(e) => setRefundRef(e.target.value)} placeholder="optional" />
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button className="sw-btn" disabled={submitting || !refundAmountUsd.trim()} onClick={recordRefund}>
              {submitting ? "Posting…" : "Post refund/chargeback"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
