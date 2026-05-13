"use client";

import { useMemo, useState } from "react";

type CoaOption = { number: string; name: string; type?: string };
type Item = {
  id: string;
  status: string;
  createdAt: string;
  accountBucket: "CARD" | "OPERATING" | "IOLTA";
  raw: {
    id: string;
    transactionDate: string;
    amountCents: number;
    direction: "INFLOW" | "OUTFLOW";
    description: string;
    payee: string | null;
    memo: string | null;
    source: string;
    accountName: string | null;
    suggestedCoaNumber: string | null;
    suggestedCoaName: string | null;
    codedCoaNumber: string | null;
  };
};

const CLASSIFICATION_OPTIONS = [
  { value: "EXPENSE", label: "Expense" },
  { value: "MERCHANT_FEE", label: "Merchant fee" },
  { value: "OWNER_TRANSFER", label: "Owner transfer" },
  { value: "IGNORE", label: "Ignore" },
];

function fmtMoney(cents: number, dir: "INFLOW" | "OUTFLOW") {
  const sign = dir === "OUTFLOW" ? -1 : 1;
  const n = (sign * cents) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function shortDate(iso: string) {
  return iso.slice(0, 10);
}

export function ReviewQueueClient({ items, coa }: { items: Item[]; coa: CoaOption[] }) {
  const [bucket, setBucket] = useState<"ALL" | Item["accountBucket"]>("ALL");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter((it) => {
      if (bucket !== "ALL" && it.accountBucket !== bucket) return false;
      if (!qq) return true;
      const hay = `${it.raw.payee || ""} ${it.raw.description || ""} ${it.raw.memo || ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [items, bucket, q]);

  async function save(it: Item, opts: { coaNumber: string; classificationType: string; rememberPayee: boolean }) {
    setBusyId(it.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/accounting/review-items/${it.id}` as string, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(opts),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok || json.ok === false) throw new Error(json.error || `HTTP ${res.status}`);
      setMsg(`Saved: ${it.raw.description}`);
      window.location.reload();
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="sw-card sw-card-pad" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 950 }}>Review queue</div>
          <div className="sw-muted" style={{ fontSize: 12, marginTop: 6 }}>
            Unreviewed transactions with suggested COA codes (from Payee Rules)
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select className="sw-input" value={bucket} onChange={(e) => setBucket(e.target.value as any)}>
            <option value="ALL">All accounts</option>
            <option value="CARD">Card</option>
            <option value="OPERATING">Operating</option>
            <option value="IOLTA">IOLTA</option>
          </select>
          <input className="sw-input" placeholder="Search payee/description…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {msg ? (
        <div className="sw-muted" style={{ marginTop: 10, fontSize: 12 }}>
          {msg}
        </div>
      ) : null}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="sw-table" style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th>Payee / Description</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Suggested COA</th>
              <th>Coding</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => (
              <Row key={it.id} it={it} coa={coa} busy={busyId === it.id} onSave={save} />
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="sw-muted" colSpan={7} style={{ padding: 14 }}>
                  Nothing to review.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  it,
  coa,
  busy,
  onSave,
}: {
  it: Item;
  coa: CoaOption[];
  busy: boolean;
  onSave: (it: Item, opts: { coaNumber: string; classificationType: string; rememberPayee: boolean }) => void;
}) {
  const suggested = it.raw.suggestedCoaNumber || "";
  const coded = it.raw.codedCoaNumber || "";

  const [coaNumber, setCoaNumber] = useState(coded || suggested);
  const [classificationType, setClassificationType] = useState("EXPENSE");
  const [rememberPayee, setRememberPayee] = useState(true);

  const displayPayee = it.raw.payee || it.raw.description;
  const showSuggested = it.raw.suggestedCoaNumber || it.raw.suggestedCoaName;

  return (
    <tr className="sw-tr">
      <td className="sw-td" style={{ whiteSpace: "nowrap" }}>
        {shortDate(it.raw.transactionDate)}
      </td>
      <td className="sw-td" style={{ whiteSpace: "nowrap" }}>
        {it.accountBucket}
        {it.raw.accountName ? <span className="sw-muted"> · {it.raw.accountName}</span> : null}
      </td>
      <td className="sw-td" style={{ maxWidth: 520 }}>
        <div style={{ fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayPayee}</div>
        <div className="sw-muted" style={{ fontSize: 12, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {it.raw.memo ? `${it.raw.description} · ${it.raw.memo}` : it.raw.description}
        </div>
      </td>
      <td className="sw-td" style={{ textAlign: "right", whiteSpace: "nowrap", fontFamily: "var(--sw-mono)" }}>
        {fmtMoney(it.raw.amountCents, it.raw.direction)}
      </td>
      <td className="sw-td" style={{ whiteSpace: "nowrap" }}>
        {showSuggested ? (
          <div>
            <div style={{ fontFamily: "var(--sw-mono)", fontWeight: 900 }}>{it.raw.suggestedCoaNumber || "—"}</div>
            <div className="sw-muted" style={{ fontSize: 12, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {it.raw.suggestedCoaName || ""}
            </div>
          </div>
        ) : (
          <span className="sw-muted">—</span>
        )}
      </td>
      <td className="sw-td">
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="sw-input"
              list="sw-coa"
              placeholder="COA #"
              value={coaNumber}
              onChange={(e) => setCoaNumber(e.target.value)}
              style={{ width: 140, fontFamily: "var(--sw-mono)" }}
            />
            {suggested && !coded ? (
              <button className="sw-btn sw-btnSm" type="button" onClick={() => setCoaNumber(suggested)}>
                Use suggested
              </button>
            ) : null}
          </div>

          <select className="sw-input" value={classificationType} onChange={(e) => setClassificationType(e.target.value)}>
            {CLASSIFICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={rememberPayee} onChange={(e) => setRememberPayee(e.target.checked)} />
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Remember payee → COA
            </span>
          </label>
        </div>

        <datalist id="sw-coa">
          {coa.map((c) => (
            <option key={c.number} value={c.number}>
              {c.number} — {c.name}
            </option>
          ))}
        </datalist>
      </td>
      <td className="sw-td" style={{ whiteSpace: "nowrap" }}>
        <button
          className="sw-btn sw-btnPrimary"
          type="button"
          disabled={busy || (classificationType !== "IGNORE" && !coaNumber.trim())}
          onClick={() => onSave(it, { coaNumber: coaNumber.trim(), classificationType, rememberPayee })}
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </td>
    </tr>
  );
}

