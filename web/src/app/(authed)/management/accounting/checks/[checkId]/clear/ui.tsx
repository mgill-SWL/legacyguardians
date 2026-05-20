"use client";

import { FormEvent, useState } from "react";

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function ClearCheckClient({
  checkId,
  candidates,
}: {
  checkId: string;
  candidates: Array<{ id: string; transactionDate: string; amountCents: number; description: string; payee: string | null; checkNumber: string }>;
}) {
  const [rawTransactionId, setRawTransactionId] = useState(candidates[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rawTransactionId) return setError("Choose a matching bank transaction.");

    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/checks/${checkId}/clear`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawTransactionId }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.href = "/management/accounting/checks";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sw-card sw-card-pad" style={{ maxWidth: 980, marginTop: 16, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 900 }}>Select matching bank transaction</div>
      <div className="sw-muted" style={{ fontSize: 12 }}>
        We only show outflow transactions on the same account with the same check # and amount.
      </div>

      {candidates.length ? (
        <select className="sw-input" value={rawTransactionId} onChange={(e) => setRawTransactionId(e.target.value)}>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.transactionDate} · #{c.checkNumber} · {usd(c.amountCents)} · {c.payee || c.description}
            </option>
          ))}
        </select>
      ) : (
        <div className="sw-muted">No matching bank transactions found yet. Import the bank CSV, or check that the check # is present.</div>
      )}

      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}

      <button className="sw-btn sw-btnPrimary" type="submit" disabled={busy || !candidates.length} style={{ width: "fit-content" }}>
        {busy ? "Clearing…" : "Mark cleared"}
      </button>
    </form>
  );
}

