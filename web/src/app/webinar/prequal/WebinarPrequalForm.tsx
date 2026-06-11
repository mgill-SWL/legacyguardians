"use client";

import { FormEvent, useState } from "react";

type WebinarPrequalFormProps = {
  campaignSlug: string;
  watchToken: string;
};

const DOC_OPTIONS = [
  ["will", "Will"],
  ["trust", "Trust"],
  ["poa", "Financial power of attorney"],
  ["medical", "Advance medical directive"],
  ["none", "None / not sure"],
];

const fieldStyle = {
  display: "grid",
  gap: 6,
} as const;

const inputStyle = {
  background: "#fff",
  border: "1px solid rgba(23, 32, 51, 0.16)",
  borderRadius: 8,
  color: "#172033",
  font: "inherit",
  padding: "11px 12px",
} as const;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function WebinarPrequalForm({ campaignSlug, watchToken }: WebinarPrequalFormProps) {
  const [docsInPlace, setDocsInPlace] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [qualified, setQualified] = useState<boolean | null>(null);

  function toggleDoc(value: string) {
    setDocsInPlace((current) => {
      if (value === "none") return current.includes("none") ? [] : ["none"];
      const withoutNone = current.filter((item) => item !== "none");
      return withoutNone.includes(value) ? withoutNone.filter((item) => item !== value) : [...withoutNone, value];
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch("/api/webinar/prequal", {
        body: JSON.stringify({
          additionalNotes: form.get("additionalNotes"),
          campaignSlug,
          docsInPlace,
          email: form.get("email"),
          estatePlanningStage: form.get("estatePlanningStage"),
          estateWorthBand: form.get("estateWorthBand"),
          firstName: form.get("firstName"),
          investReady: form.get("investReady") === "on",
          lastName: form.get("lastName"),
          phone: form.get("phone"),
          primaryConcern: form.get("primaryConcern"),
          readyToStart: form.get("readyToStart"),
          watchToken,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean; qualified?: boolean };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setQualified(Boolean(data.qualified));
      setSubmitted(true);
    } catch (error: unknown) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <section style={{ background: "#fff", border: "1px solid rgba(23, 32, 51, 0.12)", borderRadius: 8, marginTop: 22, padding: 22 }}>
        <h2 style={{ fontSize: 22, margin: 0 }}>Thank you.</h2>
        <p style={{ color: "rgba(23, 32, 51, 0.68)", lineHeight: 1.5, margin: "8px 0 0" }}>
          {qualified
            ? "Your response is in. Our team will review it and follow up about the right next step."
            : "Your response is in. Our team will review it and send the most appropriate follow-up."}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: "1px solid rgba(23, 32, 51, 0.12)", borderRadius: 8, marginTop: 22, padding: 22 }}>
      <div style={{ display: "grid", gap: 18 }}>
        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Contact</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <label style={fieldStyle}>
              <span>First name</span>
              <input name="firstName" required style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>Last name</span>
              <input name="lastName" required style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span>Phone</span>
              <input name="phone" required style={inputStyle} type="tel" />
            </label>
            <label style={fieldStyle}>
              <span>Email</span>
              <input name="email" style={inputStyle} type="email" />
            </label>
          </div>
        </section>

        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Planning posture</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={fieldStyle}>
              <span>Where are you now?</span>
              <select name="estatePlanningStage" required style={inputStyle}>
                <option value="">Select one</option>
                <option value="need-plan">I need an estate plan</option>
                <option value="update-plan">I need to update an existing plan</option>
                <option value="probate-help">I need probate or estate help</option>
                <option value="learning">I am still learning</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Main concern</span>
              <select name="primaryConcern" required style={inputStyle}>
                <option value="">Select one</option>
                <option value="avoid-probate">Avoiding probate</option>
                <option value="protect-family">Protecting spouse or children</option>
                <option value="tax-planning">Tax or advanced planning</option>
                <option value="incapacity">Incapacity decision-making</option>
                <option value="special-family">Blended family or special circumstances</option>
                <option value="other">Other / not sure</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Estimated estate size</span>
              <select name="estateWorthBand" required style={inputStyle}>
                <option value="">Select one</option>
                <option value="under-500k">Under $500k</option>
                <option value="500k-1m">$500k-$1M</option>
                <option value="1m-2m">$1M-$2M</option>
                <option value="2m-5m">$2M-$5M</option>
                <option value="5m-plus">$5M+</option>
              </select>
            </label>
            <label style={fieldStyle}>
              <span>When do you want to start?</span>
              <select name="readyToStart" required style={inputStyle}>
                <option value="">Select one</option>
                <option value="immediately">Immediately</option>
                <option value="30-days">Within 30 days</option>
                <option value="90-days">Within 90 days</option>
                <option value="later">Later / researching</option>
              </select>
            </label>
          </div>
        </section>

        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Current documents</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DOC_OPTIONS.map(([value, label]) => (
              <label
                key={value}
                style={{
                  alignItems: "center",
                  border: "1px solid rgba(23, 32, 51, 0.14)",
                  borderRadius: 999,
                  display: "inline-flex",
                  gap: 8,
                  padding: "8px 10px",
                }}
              >
                <input checked={docsInPlace.includes(value)} onChange={() => toggleDoc(value)} type="checkbox" />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
            <input name="investReady" type="checkbox" />
            <span>I am ready to discuss fees and next steps if the fit is right.</span>
          </label>
          <label style={fieldStyle}>
            <span>Anything else we should know?</span>
            <textarea name="additionalNotes" rows={4} style={inputStyle} />
          </label>
        </section>
      </div>

      {error ? <div style={{ color: "#b42318", marginTop: 14 }}>{error}</div> : null}

      <div style={{ borderTop: "1px solid rgba(23, 32, 51, 0.1)", display: "flex", justifyContent: "flex-end", marginTop: 18, paddingTop: 18 }}>
        <button
          disabled={busy}
          style={{
            background: "#2E4A7F",
            border: "1px solid #2E4A7F",
            borderRadius: 8,
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            fontWeight: 800,
            padding: "11px 16px",
          }}
          type="submit"
        >
          {busy ? "Submitting..." : "Submit"}
        </button>
      </div>
    </form>
  );
}
