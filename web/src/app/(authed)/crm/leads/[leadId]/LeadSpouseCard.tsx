"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LeadSpouseCardProps = {
  leadId: string;
  spouseFirstName?: string | null;
  spouseLastName?: string | null;
  spouseEmail?: string | null;
  spousePhone?: string | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function LeadSpouseCard({
  leadId,
  spouseFirstName,
  spouseLastName,
  spouseEmail,
  spousePhone,
}: LeadSpouseCardProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(spouseFirstName || "");
  const [lastName, setLastName] = useState(spouseLastName || "");
  const [email, setEmail] = useState(spouseEmail || "");
  const [phone, setPhone] = useState(spousePhone || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/spouse`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spouseFirstName: firstName,
          spouseLastName: lastName,
          spouseEmail: email,
          spousePhone: phone,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setSaved(true);
      router.refresh();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sw-card sw-card-pad" style={{ display: "grid", gap: 14, marginTop: 20 }}>
      <div>
        <div className="sw-muted" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
          Matter relationship
        </div>
        <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>Spouse / co-client</h2>
        <p className="sw-muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
          Used on the representation agreement and as the second signer when sending for signature.
        </p>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Spouse first name</span>
          <input className="sw-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Spouse last name</span>
          <input className="sw-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Spouse email</span>
          <input className="sw-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Spouse phone</span>
          <input className="sw-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button className="sw-btn sw-btnPrimary sw-btnSm" disabled={busy} onClick={save} type="button">
          {busy ? "Saving..." : "Save spouse"}
        </button>
        {saved ? <div style={{ color: "#16a34a", fontSize: 13, fontWeight: 700 }}>Saved.</div> : null}
        {error ? <div style={{ color: "var(--sw-danger)", fontSize: 13 }}>{error}</div> : null}
      </div>
    </section>
  );
}
