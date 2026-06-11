"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConvertLeadButton } from "../ConvertLeadButton";

type EngagementStatusCardProps = {
  convertedMatterId?: string | null;
  leadId: string;
  proposalPreparedAt?: Date | null;
  raPreparedAt?: Date | null;
  raSentAt?: Date | null;
  raSignedAt?: Date | null;
};

type Action = "proposal_prepared" | "ra_prepared" | "ra_sent" | "ra_signed";

const STEPS: { action: Action; description: string; field: keyof EngagementStatusCardProps; label: string }[] = [
  {
    action: "proposal_prepared",
    description: "Fee quote and selected representation option are ready to anchor the agreement.",
    field: "proposalPreparedAt",
    label: "Proposal prepared",
  },
  {
    action: "ra_prepared",
    description: "Representation agreement packet has been assembled or reviewed for sending.",
    field: "raPreparedAt",
    label: "Agreement prepared",
  },
  {
    action: "ra_sent",
    description: "Agreement has been sent to the prospective client for signature.",
    field: "raSentAt",
    label: "Agreement sent",
  },
  {
    action: "ra_signed",
    description: "Signed agreement is in hand; the lead can become an active matter.",
    field: "raSignedAt",
    label: "Agreement signed",
  },
];

function formatDate(value?: Date | string | null) {
  if (!value) return "Not yet";
  return new Date(value).toISOString().slice(0, 10);
}

export function EngagementStatusCard({
  convertedMatterId,
  leadId,
  proposalPreparedAt,
  raPreparedAt,
  raSentAt,
  raSignedAt,
}: EngagementStatusCardProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  const values: Record<string, Date | null | undefined> = {
    proposalPreparedAt,
    raPreparedAt,
    raSentAt,
    raSignedAt,
  };

  async function mark(action: Action) {
    setBusyAction(action);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/engagement`, {
        body: JSON.stringify({ action }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to update engagement status");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="sw-card sw-card-pad" style={{ display: "grid", gap: 14 }}>
      <div>
        <div className="sw-muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
          Engagement
        </div>
        <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Representation agreement status</h2>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {STEPS.map((step) => {
          const completedAt = values[step.field];
          return (
            <div
              key={step.action}
              style={{
                alignItems: "center",
                border: "1px solid var(--sw-border)",
                borderRadius: "var(--sw-radius-sm)",
                display: "grid",
                gap: 10,
                gridTemplateColumns: "1fr auto",
                padding: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>{step.label}</div>
                <div className="sw-muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {completedAt ? formatDate(completedAt) : step.description}
                </div>
              </div>
              <button
                className={completedAt ? "sw-btn sw-btnSm" : "sw-btn sw-btnPrimary sw-btnSm"}
                disabled={Boolean(completedAt) || busyAction === step.action || Boolean(convertedMatterId)}
                onClick={() => mark(step.action)}
                type="button"
              >
                {completedAt ? "Done" : busyAction === step.action ? "Saving..." : "Mark"}
              </button>
            </div>
          );
        })}
      </div>

      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 13 }}>{error}</div> : null}

      {convertedMatterId ? null : raSignedAt ? (
        <div style={{ borderTop: "1px solid var(--sw-border)", paddingTop: 12 }}>
          <ConvertLeadButton leadId={leadId} />
        </div>
      ) : (
        <div className="sw-muted" style={{ fontSize: 13 }}>
          Conversion unlocks after the agreement is marked signed.
        </div>
      )}
    </section>
  );
}
