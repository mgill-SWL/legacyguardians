"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LeadOption = {
  id: string;
  label: string;
  meta: string;
};

type IntakeResolutionPanelProps = {
  leadId?: string | null;
  leadOptions: LeadOption[];
  matchConfidence: string;
  matchSummary?: string | null;
  needsConflictCheck: boolean;
  status: string;
  threadId: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

function labelStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function IntakeResolutionPanel({
  leadId,
  leadOptions,
  matchConfidence,
  matchSummary,
  needsConflictCheck,
  status,
  threadId,
}: IntakeResolutionPanelProps) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState(leadId || leadOptions[0]?.id || "");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: "attach_lead" | "create_lead" | "not_lead") {
    setBusyAction(action);
    setError(null);
    try {
      const res = await fetch(`/api/crm/inbox/${threadId}/resolve`, {
        body: JSON.stringify({
          action,
          leadId: action === "attach_lead" ? selectedLeadId : undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; leadId?: string; ok?: boolean };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      if (action === "create_lead" && data.leadId) {
        router.push(`/crm/leads/${data.leadId}`);
        return;
      }
      router.refresh();
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        marginTop: 12,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <strong>Intake resolution</strong>
          <div style={{ marginTop: 6, color: "#666" }}>
            {labelStatus(status)} · match {matchConfidence.toLowerCase()}
            {needsConflictCheck ? " · conflict review needed" : ""}
          </div>
          {matchSummary ? <div style={{ marginTop: 6, color: "#666" }}>{matchSummary}</div> : null}
        </div>
        {leadId ? (
          <a href={`/crm/leads/${leadId}`} style={{ alignSelf: "start" }}>
            Open linked lead
          </a>
        ) : null}
      </div>

      <div style={{ borderTop: "1px solid #eee", display: "grid", gap: 10, marginTop: 12, paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="sw-btn sw-btnPrimary" disabled={busyAction !== null} onClick={() => resolve("create_lead")} type="button">
            {busyAction === "create_lead" ? "Creating..." : "Create lead from thread"}
          </button>
          <button className="sw-btn" disabled={busyAction !== null} onClick={() => resolve("not_lead")} type="button">
            {busyAction === "not_lead" ? "Saving..." : "Mark not a lead"}
          </button>
        </div>

        <div style={{ alignItems: "center", display: "grid", gap: 8, gridTemplateColumns: "minmax(180px, 1fr) auto" }}>
          <select
            className="sw-input"
            disabled={busyAction !== null || leadOptions.length === 0}
            onChange={(event) => setSelectedLeadId(event.target.value)}
            value={selectedLeadId}
          >
            {leadOptions.length === 0 ? <option value="">No open leads available</option> : null}
            {leadOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} - {option.meta}
              </option>
            ))}
          </select>
          <button
            className="sw-btn"
            disabled={busyAction !== null || !selectedLeadId}
            onClick={() => resolve("attach_lead")}
            type="button"
          >
            {busyAction === "attach_lead" ? "Attaching..." : "Attach selected lead"}
          </button>
        </div>
      </div>

      {error ? <div style={{ color: "var(--sw-danger, #b42318)", fontSize: 13, marginTop: 10 }}>{error}</div> : null}
    </section>
  );
}
