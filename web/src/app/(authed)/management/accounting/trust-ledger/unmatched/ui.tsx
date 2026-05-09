"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type MatterOption = { id: string; displayName: string };

type UnmatchedEvent = {
  id: string;
  eventDate: string;
  eventType: string;
  amountCents: number;
  sourceClientName: string | null;
  sourceMatterName: string | null;
  sourceInvoiceNumber: string | null;
  sourceReference: string | null;
  notes: string | null;
  importBatchId: string | null;
};

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function shortDate(iso: string) {
  return iso.slice(0, 10);
}

export function UnmatchedTrustEventsClient({ matters, events }: { matters: MatterOption[]; events: UnmatchedEvent[] }) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatterByEventId, setSelectedMatterByEventId] = useState<Record<string, string>>({});

  const matterOptions = useMemo(() => {
    return [{ id: "", displayName: "— Select matter —" }, ...matters];
  }, [matters]);

  async function link(eventId: string) {
    const matterId = selectedMatterByEventId[eventId];
    if (!matterId) return;

    setSubmittingId(eventId);
    setError(null);
    try {
      const response = await fetch("/api/accounting/trust-ledger/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId, matterId }),
      });

      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(json.error || "Link failed");

      // simplest: reload so server-side list updates
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="sw-page">
      <div className="sw-pageHeader">
        <h1 className="sw-h1">Unmatched trust events</h1>
      </div>
      <p className="sw-muted" style={{ marginTop: 8 }}>
        These trust events exist, but aren’t linked to an LG matter yet. Link them so the trust ledger can compute per-matter balances.
      </p>
      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="sw-btn" href="/management/accounting/trust-ledger">
          ← Back to trust ledger
        </Link>
      </div>

      {error ? (
        <div style={{ marginTop: 16, color: "#ffb3c1" }}>
          {error}
        </div>
      ) : null}

      <div style={{ marginTop: 16 }}>
        {events.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Source (client / matter)</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{shortDate(e.eventDate)}</td>
                  <td>{e.eventType}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{usd(e.amountCents)}</td>
                  <td style={{ maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(e.sourceClientName || "—") + " / " + (e.sourceMatterName || "—")}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={selectedMatterByEventId[e.id] || ""}
                        onChange={(ev) => setSelectedMatterByEventId((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                      >
                        {matterOptions.map((m) => (
                          <option key={m.id || "__none"} value={m.id}>
                            {m.displayName}
                          </option>
                        ))}
                      </select>
                      <button
                        className="sw-btn"
                        disabled={!selectedMatterByEventId[e.id] || submittingId === e.id}
                        onClick={() => link(e.id)}
                      >
                        {submittingId === e.id ? "Linking…" : "Link"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sw-muted">No unmatched trust events 🎉</div>
        )}
      </div>
    </div>
  );
}

