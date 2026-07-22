"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LeadIntakeCardProps = {
  leadId: string;
  intakeCallAttempted: boolean;
  appt1AtISO: string | null;
  appt1Status: string | null;
  appt2AtISO: string | null;
  appt2Status: string | null;
  leadQualityScore: number | null;
  additionalNotes: string | null;
};

const APPT_STATUS_OPTS: [string, string][] = [
  ["", "— Not set —"],
  ["SCHEDULED", "Scheduled"],
  ["SHOWED", "Showed"],
  ["NO_SHOW", "No show"],
  ["CANCELED", "Canceled"],
  ["RESCHEDULED", "Rescheduled"],
];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const labelStyle = { fontSize: 12, fontWeight: 800 } as const;

export function LeadIntakeCard({
  leadId,
  intakeCallAttempted,
  appt1AtISO,
  appt1Status,
  appt2AtISO,
  appt2Status,
  leadQualityScore,
  additionalNotes,
}: LeadIntakeCardProps) {
  const router = useRouter();
  const [attempted, setAttempted] = useState(intakeCallAttempted);
  const [appt1, setAppt1] = useState(toLocalInput(appt1AtISO));
  const [appt1St, setAppt1St] = useState(appt1Status ?? "");
  const [appt2, setAppt2] = useState(toLocalInput(appt2AtISO));
  const [appt2St, setAppt2St] = useState(appt2Status ?? "");
  const [score, setScore] = useState(leadQualityScore == null ? "" : String(leadQualityScore));
  const [notes, setNotes] = useState(additionalNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/intake`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeCallAttempted: attempted,
          appt1At: appt1 ? new Date(appt1).toISOString() : null,
          appt1Status: appt1St || null,
          appt2At: appt2 ? new Date(appt2).toISOString() : null,
          appt2Status: appt2St || null,
          leadQualityScore: score === "" ? null : Number(score),
          additionalNotes: notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setSaved(true);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sw-card sw-card-pad" style={{ display: "grid", gap: 14, marginTop: 20 }}>
      <div>
        <div className="sw-muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
          Intake
        </div>
        <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Intake &amp; appointments</h2>
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={attempted} onChange={(e) => setAttempted(e.target.checked)} />
        <span style={labelStyle}>Intake call attempted</span>
      </label>

      <div style={{ border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", padding: 12, display: "grid", gap: 8 }}>
        <span style={labelStyle}>Discovery call</span>
        <input className="sw-input" type="datetime-local" value={appt1} onChange={(e) => setAppt1(e.target.value)} />
        <select className="sw-input" value={appt1St} onChange={(e) => setAppt1St(e.target.value)}>
          {APPT_STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div style={{ border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", padding: 12, display: "grid", gap: 8 }}>
        <span style={labelStyle}>Document tour</span>
        <input className="sw-input" type="datetime-local" value={appt2} onChange={(e) => setAppt2(e.target.value)} />
        <select className="sw-input" value={appt2St} onChange={(e) => setAppt2St(e.target.value)}>
          {APPT_STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={labelStyle}>Lead quality score (0–100)</span>
        <input className="sw-input" type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span style={labelStyle}>Notes</span>
        <textarea className="sw-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="sw-btn sw-btnPrimary sw-btnSm" disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save intake"}
        </button>
        {saved ? <span style={{ color: "#16a34a", fontSize: 13, fontWeight: 700 }}>Saved.</span> : null}
        {error ? <span style={{ color: "var(--sw-danger)", fontSize: 13 }}>{error}</span> : null}
      </div>
    </section>
  );
}
