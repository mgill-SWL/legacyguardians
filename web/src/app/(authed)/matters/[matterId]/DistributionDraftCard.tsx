"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Wish = { presetKey?: string; text?: string };
type IntakeShape = {
  offering?: string;
  grantors?: [string, string];
  wishes?: { distribution?: { spouse1?: Wish; spouse2?: Wish } };
  draftedClauses?: { distribution?: string };
  [k: string]: unknown;
};

const TRUST_OFFERINGS = ["JOINT_TRUST", "INDIVIDUAL_TRUST", "RECIPROCAL_TRUSTS"];

export default function DistributionDraftCard({ matterId }: { matterId: string }) {
  const [intake, setIntake] = useState<IntakeShape | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [clause, setClause] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/matters/${matterId}/intake`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const i = (data?.intake ?? null) as IntakeShape | null;
          if (!cancelled && i) {
            setIntake(i);
            setClause(i.draftedClauses?.distribution ?? "");
          }
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matterId]);

  async function generate() {
    setBusy(true);
    setError(null);
    setNotes([]);
    try {
      const res = await fetch(`/api/matters/${matterId}/draft/distribution`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instructions }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: boolean; clause?: string; notes?: string[]; error?: string }
        | null;
      if (!data?.ok) {
        setError(data?.error || `Draft failed (${res.status})`);
        return;
      }
      setClause(data.clause || "");
      const incoming = Array.isArray(data.notes) ? data.notes : [];
      setNotes(
        data.clause
          ? incoming
          : ["The standard template language already covers these wishes — no bespoke clause needed.", ...incoming],
      );
    } catch {
      setError("Draft failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!intake) return;
    setSaving(true);
    setError(null);
    try {
      const merged: IntakeShape = {
        ...intake,
        draftedClauses: { ...(intake.draftedClauses || {}), distribution: clause },
      };
      const res = await fetch(`/api/matters/${matterId}/intake`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intake: merged }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || `Save failed (${res.status})`);
        return;
      }
      setIntake(merged);
      setSavedAt(new Date().toLocaleTimeString());
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div style={{ color: "var(--sw-muted)" }}>Loading…</div>;
  if (!intake) {
    return (
      <div style={{ color: "var(--sw-muted)" }}>
        Start intake for this matter to enable distribution drafting.
      </div>
    );
  }

  const w1 = intake.wishes?.distribution?.spouse1?.text?.trim() || "";
  const w2 = intake.wishes?.distribution?.spouse2?.text?.trim() || "";
  const g1 = intake.grantors?.[0] || "Grantor 1";
  const g2 = intake.grantors?.[1] || "";
  const hasWishes = Boolean(w1 || w2);
  const isTrust = TRUST_OFFERINGS.includes(intake.offering || "");

  const fieldStyle: CSSProperties = {
    width: "100%",
    padding: 10,
    borderRadius: "var(--sw-radius-sm)",
    border: "1px solid var(--sw-border)",
    background: "rgba(0,0,0,0.25)",
    color: "var(--sw-text)",
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: "inherit",
    resize: "vertical" as const,
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          padding: 10,
          borderRadius: "var(--sw-radius-sm)",
          border: "1px solid rgba(251,191,36,0.45)",
          background: "rgba(251,191,36,0.08)",
          fontSize: 12.5,
          color: "var(--sw-text)",
        }}
      >
        <strong>Attorney review required.</strong> This is an AI-assisted first draft of the{" "}
        <em>bespoke</em> distribution provisions only — it supplements, and does not replace, the
        template&rsquo;s vetted default residuary language. Read, edit, and verify before saving.
      </div>

      {!isTrust ? (
        <div style={{ color: "var(--sw-muted)", fontSize: 12.5 }}>
          Note: this matter&rsquo;s offering is <strong>{intake.offering || "unset"}</strong>. The
          drafted language targets trust distribution articles.
        </div>
      ) : null}

      <div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
          Client distribution wishes (from intake)
        </div>
        {hasWishes ? (
          <div style={{ display: "grid", gap: 6, fontSize: 12.5, color: "var(--sw-muted)" }}>
            {w1 ? (
              <div>
                <strong>{g1}:</strong> {w1}
              </div>
            ) : null}
            {g2 && w2 ? (
              <div>
                <strong>{g2}:</strong> {w2}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: "var(--sw-muted)", fontSize: 12.5 }}>
            No distribution wishes recorded yet. Capture them in the EPIS, or type instructions
            below.
          </div>
        )}
      </div>

      <div>
        <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6 }}>
          Additional drafting instructions (optional)
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="e.g. $25,000 to St. Jude; remainder split 60/40 between the two children; son's share held in trust until age 30."
          style={fieldStyle}
        />
      </div>

      <div>
        <button
          type="button"
          disabled={busy}
          onClick={generate}
          style={{
            padding: "10px 12px",
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid rgba(110,231,255,0.45)",
            background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
            fontWeight: 800,
            color: "var(--sw-text)",
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "Drafting…" : clause ? "Re-draft with AI" : "Draft distribution language with AI"}
        </button>
      </div>

      {error ? (
        <p style={{ margin: 0, color: "#f87171", fontWeight: 700, fontSize: 13 }}>{error}</p>
      ) : null}

      {notes.length ? (
        <div
          style={{
            padding: 10,
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid rgba(248,113,113,0.5)",
            background: "rgba(248,113,113,0.07)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 12.5, marginBottom: 6 }}>Drafting notes</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--sw-text)" }}>
            {notes.map((n, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {n}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <label style={{ fontWeight: 700, fontSize: 13, display: "block", marginBottom: 6 }}>
          Distribution clause (editable)
        </label>
        <textarea
          value={clause}
          onChange={(e) => setClause(e.target.value)}
          rows={10}
          placeholder="The drafted clause will appear here. You can also write or paste language directly."
          style={fieldStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          style={{
            padding: "10px 12px",
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid var(--sw-border)",
            background: "rgba(255,255,255,0.04)",
            fontWeight: 800,
            color: "var(--sw-text)",
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save to matter"}
        </button>
        {savedAt ? (
          <span style={{ color: "var(--sw-muted)", fontSize: 12.5 }}>Saved at {savedAt}</span>
        ) : null}
      </div>
    </div>
  );
}
