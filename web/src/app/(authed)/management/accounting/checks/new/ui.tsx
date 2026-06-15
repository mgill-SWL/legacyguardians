"use client";

import { FormEvent, useMemo, useState } from "react";

type Account = { id: string; name: string; kind: string };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function NewCheckClient({
  accounts,
  defaultAccountId,
  proposedByAccountId,
}: {
  accounts: Account[];
  defaultAccountId: string | null;
  proposedByAccountId: Record<string, string>;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId || "");
  const [checkNumber, setCheckNumber] = useState("");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [payeeName, setPayeeName] = useState("");
  const [amountUsd, setAmountUsd] = useState("");
  const [memo, setMemo] = useState("");
  const [toBePrinted, setToBePrinted] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const proposed = useMemo(() => {
    if (!accountId) return "";
    return proposedByAccountId[accountId] || "";
  }, [accountId, proposedByAccountId]);

  // When account changes, prefill check number only if user hasn't typed one.
  function onAccountChange(nextId: string) {
    setAccountId(nextId);
    setError(null);
    // When printing, we don't assign a number until print time.
    if (toBePrinted) setCheckNumber("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) return setError("Choose a bank account.");
    if (!toBePrinted && !checkNumber.trim()) return setError("Check number is required when not printing.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) return setError("Issue date must be YYYY-MM-DD.");
    if (!payeeName.trim()) return setError("Payee is required.");
    if (!amountUsd.trim()) return setError("Amount is required.");

    setBusy(true);
    try {
      const res = await fetch("/api/accounting/checks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          financialAccountId: accountId,
          checkNumber: checkNumber.trim(),
          issueDate,
          payeeName: payeeName.trim(),
          amountUsd: amountUsd.trim(),
          memo: memo.trim() || null,
          toBePrinted,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      window.location.href = "/management/accounting/checks";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sw-card sw-card-pad" style={{ maxWidth: 860, marginTop: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 900 }}>Bank account</div>
        <select className="sw-input" value={accountId} onChange={(e) => onAccountChange(e.target.value)}>
          <option value="">Select…</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.kind})
            </option>
          ))}
        </select>
        {accountId && proposed ? (
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Proposed next check #: <span style={{ fontFamily: "var(--sw-mono)", fontWeight: 900 }}>{proposed}</span>
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Check #</div>
            <input
              className="sw-input"
              value={toBePrinted ? "To print" : checkNumber}
              onChange={(e) => {
                const v = e.target.value;
                // If user is handwriting / not printing, restrict to digits like CosmoLex.
                if (!toBePrinted && /[^0-9]/.test(v)) return;
                setCheckNumber(v);
              }}
              placeholder={proposed || "e.g., 1042"}
              disabled={toBePrinted}
            />
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <input
              type="checkbox"
              checked={toBePrinted}
              onChange={(e) => {
                const next = e.target.checked;
                setToBePrinted(next);
                // When switching to printing mode, do not assign a number yet.
                if (next) setCheckNumber("");
              }}
            />
            <span className="sw-muted" style={{ fontSize: 12 }}>
              To be printed
            </span>
          </label>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Issue date</div>
          <input className="sw-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} placeholder="YYYY-MM-DD" />
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontWeight: 900 }}>Payee</div>
        <input className="sw-input" value={payeeName} onChange={(e) => setPayeeName(e.target.value)} placeholder="Vendor name" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Amount</div>
          <input className="sw-input" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} placeholder="$0.00" />
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 900 }}>Memo (optional)</div>
          <input className="sw-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Notes" />
        </div>
      </div>

      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="sw-btn sw-btnPrimary" type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create check"}
        </button>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Creates a draft check record (we’ll add “issue/print” + clearing next).
        </div>
      </div>
    </form>
  );
}
