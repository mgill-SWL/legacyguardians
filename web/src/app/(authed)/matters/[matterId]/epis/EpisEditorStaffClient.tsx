"use client";

import { useEffect, useRef, useState } from "react";

type Intake = any;

const SECTIONS: Array<{ key: string; label: string }> = [
  { key: "client_info", label: "Client information" },
  { key: "children", label: "Children" },
  { key: "fiduciaries", label: "Potential fiduciuciaries" },
  { key: "estate_value", label: "Value of estate" },
  { key: "distribution", label: "Distribution wishes" },
  { key: "pets", label: "Pets" },
  { key: "burial", label: "Burial wishes" },
  { key: "advisors", label: "Professional advisors" },
  { key: "conflicts", label: "Conflict waiver" },
];

function ensureNotes(intake: Intake) {
  const n = (intake?.__staffNotes ?? {}) as any;
  if (!n || typeof n !== "object") return { sections: {} as Record<string, string> };
  n.sections = n.sections && typeof n.sections === "object" ? n.sections : {};
  return n;
}

export function EpisEditorStaffClient({ matterId }: { matterId: string }) {
  const [loading, setLoading] = useState(true);
  const [intake, setIntake] = useState<Intake | null>(null);
  const [status, setStatus] = useState<string>("");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/matters/${matterId}/epis`, { cache: "no-store" });
      if (!res.ok) {
        setStatus(`Error (${res.status})`);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { intake: any };
      const incoming = data.intake || {};
      incoming.__staffNotes = ensureNotes(incoming);
      setIntake(incoming);
      setLoading(false);
    })();
  }, [matterId]);

  function queueSave(nextIntake: any) {
    setIntake(nextIntake);
    setStatus("Unsaved changes…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setStatus("Saving…");
        const res = await fetch(`/api/matters/${matterId}/epis`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ intake: nextIntake }),
        });
        if (!res.ok) {
          setStatus(`Save failed (${res.status})`);
          return;
        }
        const out = (await res.json()) as { updatedAt?: string };
        setLastSavedAt(out.updatedAt ? new Date(out.updatedAt).toLocaleString() : new Date().toLocaleString());
        setStatus("Saved");
      } catch (e: any) {
        setStatus(e?.message || "Save failed");
      }
    }, 600);
  }

  if (loading) {
    return <div>Loading…</div>;
  }
  if (!intake) {
    return <div>{status || "Unable to load."}</div>;
  }

  const notes = ensureNotes(intake);
  const sections = notes.sections as Record<string, string>;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "44px 18px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>EPIS — Staff notes</h1>
      <div style={{ marginTop: 8, color: "var(--sw-muted)", fontSize: 13 }}>
        Autosave is on. {lastSavedAt ? `Last saved: ${lastSavedAt}.` : ""} {status}
      </div>

      <section style={card}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Per-section attorney notes (private)</div>
        <div style={{ display: "grid", gap: 12 }}>
          {SECTIONS.map((s) => (
            <label key={s.key} style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>{s.label}</span>
              <textarea
                value={sections[s.key] || ""}
                onChange={(e) => {
                  const next = JSON.parse(JSON.stringify(intake));
                  next.__staffNotes = ensureNotes(next);
                  next.__staffNotes.sections = next.__staffNotes.sections || {};
                  next.__staffNotes.sections[s.key] = e.target.value;
                  queueSave(next);
                }}
                placeholder="Notes…"
                rows={4}
                style={{
                  ...input,
                  fontFamily: "ui-sans-serif, system-ui, -apple-system",
                  resize: "vertical",
                }}
              />
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}

const card: React.CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: "var(--sw-radius)",
  background: "var(--sw-card)",
  border: "1px solid var(--sw-border)",
};

const input: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid var(--sw-border)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--sw-text)",
  outline: "none",
};

