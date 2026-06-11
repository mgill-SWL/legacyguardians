"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LeadReviewPanelProps = {
  conflictCheckNotes?: string | null;
  conflictCheckStatus: string;
  duplicateReviewNotes?: string | null;
  duplicateReviewStatus: string;
  leadId: string;
};

const CONFLICT_OPTIONS = [
  { label: "Review required", value: "REVIEW_REQUIRED" },
  { label: "Cleared", value: "CLEARED" },
  { label: "Conflict identified", value: "CONFLICT_IDENTIFIED" },
  { label: "Waived", value: "WAIVED" },
  { label: "Not started", value: "NOT_STARTED" },
];

const DUPLICATE_OPTIONS = [
  { label: "None", value: "NONE" },
  { label: "Possible duplicate", value: "POSSIBLE_DUPLICATE" },
  { label: "Duplicate confirmed", value: "DUPLICATE_CONFIRMED" },
  { label: "Not duplicate", value: "NOT_DUPLICATE" },
];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function LeadReviewPanel({
  conflictCheckNotes,
  conflictCheckStatus,
  duplicateReviewNotes,
  duplicateReviewStatus,
  leadId,
}: LeadReviewPanelProps) {
  const router = useRouter();
  const [conflictStatus, setConflictStatus] = useState(conflictCheckStatus);
  const [conflictNotes, setConflictNotes] = useState(conflictCheckNotes || "");
  const [duplicateStatus, setDuplicateStatus] = useState(duplicateReviewStatus);
  const [duplicateNotes, setDuplicateNotes] = useState(duplicateReviewNotes || "");
  const [busy, setBusy] = useState<"conflict" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(kind: "conflict" | "duplicate") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/review`, {
        body: JSON.stringify(
          kind === "conflict"
            ? {
                conflictCheckNotes: conflictNotes,
                conflictCheckStatus: conflictStatus,
              }
            : {
                duplicateReviewNotes: duplicateNotes,
                duplicateReviewStatus: duplicateStatus,
              }
        ),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="sw-card sw-card-pad" style={{ display: "grid", gap: 14, marginTop: 20 }}>
      <div>
        <div className="sw-muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
          Intake review
        </div>
        <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Duplicate and conflict checks</h2>
      </div>

      <div style={{ border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", display: "grid", gap: 10, padding: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Conflict status</span>
          <select className="sw-input" onChange={(event) => setConflictStatus(event.target.value)} value={conflictStatus}>
            {CONFLICT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Conflict notes</span>
          <textarea className="sw-input" onChange={(event) => setConflictNotes(event.target.value)} rows={3} value={conflictNotes} />
        </label>
        <button className="sw-btn sw-btnPrimary sw-btnSm" disabled={busy !== null} onClick={() => save("conflict")} type="button">
          {busy === "conflict" ? "Saving..." : "Save conflict check"}
        </button>
      </div>

      <div style={{ border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", display: "grid", gap: 10, padding: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Duplicate status</span>
          <select className="sw-input" onChange={(event) => setDuplicateStatus(event.target.value)} value={duplicateStatus}>
            {DUPLICATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Duplicate notes</span>
          <textarea className="sw-input" onChange={(event) => setDuplicateNotes(event.target.value)} rows={3} value={duplicateNotes} />
        </label>
        <button className="sw-btn sw-btnSm" disabled={busy !== null} onClick={() => save("duplicate")} type="button">
          {busy === "duplicate" ? "Saving..." : "Save duplicate review"}
        </button>
      </div>

      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 13 }}>{error}</div> : null}
    </section>
  );
}
