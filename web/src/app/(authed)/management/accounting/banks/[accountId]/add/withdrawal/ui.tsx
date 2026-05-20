"use client";

import { FormEvent, useState } from "react";

type Method = "CHECK" | "ACH" | "WIRE" | "CARD" | "CASH" | "OTHER";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function WithdrawalClient({
  financialAccountId,
  accountName,
  proposedCheckNumber,
}: {
  financialAccountId: string;
  accountName: string;
  proposedCheckNumber: string;
}) {
  const [date, setDate] = useState(todayIso());
  const [payeeName, setPayeeName] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [memo, setMemo] = useState("");
  const [method, setMethod] = useState<Method>("CHECK");

  // CosmoLex-like: "To be printed" defaults checked; when checked, propose next check # and disable manual entry.
  const [toBePrinted, setToBePrinted] = useState(true);
  const [checkNumber, setCheckNumber] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError("Date must be YYYY-MM-DD.");
    if (!payeeName.trim()) return setError("Payee is required.");
    if (!amountUsd.trim()) return setError("Amount is required.");

    if (method !== "CHECK") {
      return setError("Only Method=Check is implemented in v1.");
    }

    if (!toBePrinted && !checkNumber.trim()) return setError("Check number is required when not printing.");
    if (!toBePrinted && /[^0-9]/.test(checkNumber)) return setError("Check number must be digits when not printing.");

    setBusy(true);
    try {
      const res = await fetch("/api/accounting/banks/withdrawals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          financialAccountId,
          issueDate: date,
          payeeName: payeeName.trim(),
          amountUsd: amountUsd.trim(),
          memo: memo.trim() || null,
          method,
          toBePrinted,
          checkNumber: checkNumber.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);

      if (json.printUrl) {
        window.location.href = json.printUrl as string;
      } else {
        window.location.href = `/management/accounting/banks/${financialAccountId}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sw-card sw-card-pad" style={{ maxWidth: 920, marginTop: 16, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 900 }}>Withdrawal</div>
      <div className="sw-muted" style={{ fontSize: 12 }}>
        {accountName}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Date</div>
          <input className="sw-input" value={date} onChange={(e) => setDate(e.target.value)} placeholder="YYYY-MM-DD" />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Method</div>
          <select className="sw-input" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            <option value="CHECK">Check</option>
            <option value="ACH">ACH (soon)</option>
            <option value="WIRE">Wire (soon)</option>
            <option value="CARD">Card (soon)</option>
            <option value="CASH">Cash (soon)</option>
            <option value="OTHER">Other (soon)</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 900 }}>Payee</div>
        <input className="sw-input" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Vendor" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Amount</div>
          <input className="sw-input" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} placeholder="$0.00" />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Memo (optional)</div>
          <input className="sw-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo" />
        </div>
      </div>

      {method === "CHECK" ? (
        <div style={{ display: "grid", gap: 8, borderTop: "1px solid var(--sw-border)", paddingTop: 12 }}>
          <div style={{ fontWeight: 900 }}>Check</div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={toBePrinted}
              onChange={(e) => {
                const next = e.target.checked;
                setToBePrinted(next);
                if (next) setCheckNumber(proposedCheckNumber);
              }}
            />
            <span className="sw-muted" style={{ fontSize: 12 }}>
              To be printed
            </span>
          </label>

          <div style={{ display: "grid", gap: 6, maxWidth: 320 }}>
            <div style={{ fontWeight: 900 }}>Check #</div>
            <input
              className="sw-input"
              value={toBePrinted ? "To print" : checkNumber}
              onChange={(e) => {
                const v = e.target.value;
                if (!toBePrinted && /[^0-9]/.test(v)) return;
                setCheckNumber(v);
              }}
              disabled={toBePrinted}
            />
            <div className="sw-muted" style={{ fontSize: 12 }}>
              Proposed next: <span style={{ fontFamily: "var(--sw-mono)", fontWeight: 900 }}>{proposedCheckNumber}</span>
            </div>
          </div>
        </div>
      ) : null}

      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}

      <button className="sw-btn sw-btnPrimary" type="submit" disabled={busy} style={{ width: "fit-content" }}>
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
