"use client";

import type { PracticeArea } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LITIGATION_SUBJECT_AREAS, PRACTICE_AREAS } from "@/lib/matter/practiceArea";

export function MatterClassificationForm({
  matterId,
  practiceArea,
  litigationSubjectArea,
}: {
  matterId: string;
  practiceArea: PracticeArea | null;
  litigationSubjectArea: PracticeArea | null;
}) {
  const router = useRouter();
  const [area, setArea] = useState<string>(practiceArea ?? "");
  const [subject, setSubject] = useState<string>(litigationSubjectArea ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/classification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceArea: area || null,
          litigationSubjectArea: area === "LITIGATION" ? subject || null : null,
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
    <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>Practice area</span>
        <select className="sw-input" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">— Not set —</option>
          {PRACTICE_AREAS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      {area === "LITIGATION" ? (
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Underlying subject (what the dispute is about)</span>
          <select className="sw-input" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">— Not set —</option>
            {LITIGATION_SUBJECT_AREAS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div>
        <button type="button" className="sw-btn sw-btnPrimary sw-btnSm" disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save classification"}
        </button>
      </div>
      {saved ? <div style={{ color: "#16a34a", fontSize: 13, fontWeight: 700 }}>Saved.</div> : null}
      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 13 }}>{error}</div> : null}
    </div>
  );
}
