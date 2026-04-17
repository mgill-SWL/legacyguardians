"use client";

import { useState } from "react";

export function PipelineFieldsForm({
  matterId,
  primaryEmail,
  primaryPhone,
  estimatedValueCents,
  intakeSpecialistId,
  leadAttorneyId,
  users,
}: {
  matterId: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  estimatedValueCents: number;
  intakeSpecialistId: string | null;
  leadAttorneyId: string | null;
  users: { id: string; email: string | null; name: string | null }[];
}) {
  const [email, setEmail] = useState(primaryEmail || "");
  const [phone, setPhone] = useState(primaryPhone || "");
  const [value, setValue] = useState(estimatedValueCents ? String(Math.round(estimatedValueCents / 100)) : "");
  const [intakeId, setIntakeId] = useState(intakeSpecialistId || "");
  const [attorneyId, setAttorneyId] = useState(leadAttorneyId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const cents = value.trim() ? Math.max(0, Math.round(Number(value) * 100)) : 0;

      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          primaryEmail: email.trim() ? email.trim() : null,
          primaryPhone: phone.trim() ? phone.trim() : null,
          estimatedValueCents: cents,
          intakeSpecialistId: intakeId || null,
          leadAttorneyId: attorneyId || null,
        }),
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
          <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(555) 555-5555"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Estimated case value (USD)</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            inputMode="numeric"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Intake specialist</span>
          <select
            value={intakeId}
            onChange={(e) => setIntakeId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id} style={{ color: "#000" }}>
                {u.email}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Lead attorney</span>
          <select
            value={attorneyId}
            onChange={(e) => setAttorneyId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          >
            <option value="">—</option>
            {users.map((u) => (
              <option key={u.id} value={u.id} style={{ color: "#000" }}>
                {u.email}
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
        {savedAt ? (
          <span style={{ fontSize: 12, color: "var(--sw-muted)" }}>Saved</span>
        ) : null}
        {error ? <span style={{ fontSize: 12, color: "var(--sw-danger)" }}>{error}</span> : null}
      </div>
    </div>
  );
}
