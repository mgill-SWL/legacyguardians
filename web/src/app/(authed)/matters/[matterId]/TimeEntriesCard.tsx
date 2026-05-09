"use client";

import { FormEvent, useMemo, useState } from "react";

type Entry = {
  id: string;
  workDate: string;
  narrative: string;
  pricingMode: "HOURLY" | "FLAT";
  durationMinutes: number;
  hourlyRateCents: number | null;
  flatAmountCents: number | null;
  billable: boolean;
  status: "DRAFT" | "INVOICED" | "VOID";
  timekeeper: { id: string; email: string | null; name: string | null };
};

type UserOption = { id: string; email: string | null; name: string | null };

type LocationOption = { id: string; name: string; slug: string };

function usd(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function minutesToTenths(mins: number) {
  return Math.round((mins / 6) * 10) / 10;
}

export function TimeEntriesCard({
  matterId,
  users,
  locations,
  initialEntries,
}: {
  matterId: string;
  users: UserOption[];
  locations: LocationOption[];
  initialEntries: Entry[];
}) {
  const [entries] = useState<Entry[]>(initialEntries);
  const [pricingMode, setPricingMode] = useState<"HOURLY" | "FLAT">("HOURLY");
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [narrative, setNarrative] = useState<string>("");
  const [durationTenths, setDurationTenths] = useState<string>("0.1");
  const [flatAmountUsd, setFlatAmountUsd] = useState<string>("");
  const [timekeeperUserId, setTimekeeperUserId] = useState<string>(users[0]?.id || "");
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDraftValueCents = useMemo(() => {
    return entries
      .filter((e) => e.status === "DRAFT" && e.billable)
      .reduce((sum, e) => {
        if (e.pricingMode === "FLAT") return sum + (e.flatAmountCents || 0);
        // hourly amount depends on rate; if absent, we can't total yet
        return sum;
      }, 0);
  }, [entries]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          matterId,
          workDate,
          narrative,
          pricingMode,
          locationId,
          durationTenths: pricingMode === "HOURLY" ? durationTenths : undefined,
          flatAmountUsd: pricingMode === "FLAT" ? flatAmountUsd : undefined,
          timekeeperUserId,
          billable: true,
        }),
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
    <section
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: "var(--sw-radius)",
        background: "var(--sw-card)",
        border: "1px solid var(--sw-border)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Timecards</div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Pricing
          </span>
          <select value={pricingMode} onChange={(ev) => setPricingMode(ev.target.value as any)}>
            <option value="HOURLY">Hourly (tenths)</option>
            <option value="FLAT">Flat price (per timecard)</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Date
          </span>
          <input type="date" value={workDate} onChange={(ev) => setWorkDate(ev.target.value)} />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Timekeeper
          </span>
          <select value={timekeeperUserId} onChange={(ev) => setTimekeeperUserId(ev.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email || u.id}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Location
          </span>
          <select value={locationId} onChange={(ev) => setLocationId(ev.target.value)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.slug} — {l.name}
              </option>
            ))}
          </select>
        </label>

        {pricingMode === "HOURLY" ? (
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Duration (tenths)
            </span>
            <input value={durationTenths} onChange={(ev) => setDurationTenths(ev.target.value)} placeholder="e.g. 0.3" />
          </label>
        ) : (
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Flat amount (USD)
            </span>
            <input value={flatAmountUsd} onChange={(ev) => setFlatAmountUsd(ev.target.value)} placeholder="e.g. 2800" />
          </label>
        )}

        <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
          <span className="sw-muted" style={{ fontSize: 12 }}>
            Narrative
          </span>
          <input value={narrative} onChange={(ev) => setNarrative(ev.target.value)} placeholder='e.g. "Will Base Price"' />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center", gridColumn: "1 / -1" }}>
          <button className="sw-btn" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Add timecard"}
          </button>
          {error ? <div style={{ color: "#ffb3c1" }}>{error}</div> : null}
        </div>
      </form>

      <div className="sw-muted" style={{ marginTop: 10, fontSize: 12 }}>
        Draft flat-fee value tracked here (hourly totals need rates): {usd(totalDraftValueCents)}
      </div>

      <div style={{ marginTop: 14 }}>
        {entries.length ? (
          <table className="sw-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Timekeeper</th>
                <th>Pricing</th>
                <th style={{ textAlign: "right" }}>Qty</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Narrative</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((t) => (
                <tr key={t.id}>
                  <td>{t.workDate.slice(0, 10)}</td>
                  <td>{t.timekeeper.name || t.timekeeper.email || "—"}</td>
                  <td>{t.pricingMode}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {t.pricingMode === "HOURLY" ? minutesToTenths(t.durationMinutes).toFixed(1) : "0.0"}
                  </td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {t.pricingMode === "FLAT" ? usd(t.flatAmountCents || 0) : "—"}
                  </td>
                  <td style={{ maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.narrative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="sw-muted">No timecards yet.</div>
        )}
      </div>
    </section>
  );
}
