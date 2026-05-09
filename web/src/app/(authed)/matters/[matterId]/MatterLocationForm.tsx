"use client";

import { useState } from "react";

export function MatterLocationForm({
  matterId,
  primaryLocationId,
  locations,
}: {
  matterId: string;
  primaryLocationId: string | null;
  locations: { id: string; name: string; slug: string; active: boolean }[];
}) {
  const [locationId, setLocationId] = useState(primaryLocationId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primaryLocationId: locationId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Primary location</span>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          >
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id} style={{ color: "#000" }}>
                {l.slug} — {l.name}{l.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 12px",
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid rgba(110,231,255,0.45)",
            background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
            fontWeight: 900,
            color: "inherit",
            cursor: "pointer",
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedAt ? <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Saved</span> : null}
        {error ? <span style={{ fontSize: 12, color: "var(--sw-danger)" }}>{error}</span> : null}
      </div>
    </div>
  );
}

