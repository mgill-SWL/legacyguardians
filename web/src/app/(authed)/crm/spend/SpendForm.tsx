"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SpendForm({
  campaigns,
}: {
  campaigns: { id: string; slug: string; name: string }[];
}) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || "");
  const [dayKey, setDayKey] = useState(() => {
    const d = new Date();
    // Default to today's date in YYYY-MM-DD (local; close enough for data entry)
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const amountDollars = Number(amount);
      const res = await fetch("/api/crm/spend/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, dayKey, amountDollars }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `Failed (${res.status})`);
      setAmount("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
        borderRadius: 14,
        padding: 16,
        background: "rgba(255,255,255,0.03)",
        maxWidth: 720,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 10 }}>Add / update daily ad spend</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 160px", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>Campaign</div>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            style={{
              padding: "10px 10px",
              borderRadius: 10,
              border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
              background: "rgba(255,255,255,0.03)",
              color: "inherit",
            }}
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id} style={{ color: "#000" }}>
                {c.slug}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>Day (ET)</div>
          <input
            type="date"
            value={dayKey}
            onChange={(e) => setDayKey(e.target.value)}
            style={{
              padding: "10px 10px",
              borderRadius: 10,
              border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
              background: "rgba(255,255,255,0.03)",
              color: "inherit",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>Amount ($)</div>
          <input
            inputMode="decimal"
            placeholder="e.g. 204.40"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              padding: "10px 10px",
              borderRadius: 10,
              border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
              background: "rgba(255,255,255,0.03)",
              color: "inherit",
            }}
          />
        </label>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={submit}
          disabled={busy || !campaignId || !dayKey || !amount}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(110,231,255,0.45)",
            background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
            fontWeight: 900,
            cursor: busy ? "not-allowed" : "pointer",
            color: "inherit",
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {error ? <div style={{ color: "#ffb4b4" }}>{error}</div> : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
        MVP: we store the day as a date bucket for Eastern Time.
      </div>
    </div>
  );
}
