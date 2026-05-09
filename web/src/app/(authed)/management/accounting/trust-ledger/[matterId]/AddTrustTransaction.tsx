"use client";

import { FormEvent, useState } from "react";

type Props = { matterId: string };

type EventType = "TRUST_DEPOSIT" | "TRUST_APPLIED" | "TRANSFER" | "REFUND";

export function AddTrustTransaction({ matterId }: Props) {
  const [eventType, setEventType] = useState<EventType>("TRUST_DEPOSIT");
  const [eventDate, setEventDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [amountUsd, setAmountUsd] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/accounting/trust-ledger/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matterId, eventType, eventDate, amountUsd, memo }),
      });

      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(json.error || "Create failed");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sw-card sw-card-pad" style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Add trust transaction</div>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Type
          </span>
          <select value={eventType} onChange={(ev) => setEventType(ev.target.value as EventType)}>
            <option value="TRUST_DEPOSIT">Trust deposit (increase)</option>
            <option value="TRUST_APPLIED">Trust disbursement (decrease)</option>
            <option value="TRANSFER">Trust → operating transfer (decrease)</option>
            <option value="REFUND">Refund / return (decrease)</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Date
          </span>
          <input type="date" value={eventDate} onChange={(ev) => setEventDate(ev.target.value)} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Amount (USD)
          </span>
          <input value={amountUsd} onChange={(ev) => setAmountUsd(ev.target.value)} placeholder="e.g., 2500" />
        </label>

        <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Memo
          </span>
          <input value={memo} onChange={(ev) => setMemo(ev.target.value)} placeholder="optional" />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center", gridColumn: "1 / -1" }}>
          <button className="sw-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Add transaction"}
          </button>
          {error ? <div style={{ color: "#ffb3c1" }}>{error}</div> : null}
        </div>
      </form>
      <div className="sw-muted" style={{ fontSize: 12, marginTop: 10 }}>
        Guardrail: decreases are blocked if they’d make the matter’s trust balance go negative.
      </div>
    </div>
  );
}

