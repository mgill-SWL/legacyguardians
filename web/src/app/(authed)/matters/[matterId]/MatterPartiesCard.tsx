"use client";

import type { MatterPartyRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MATTER_PARTY_ROLE_LABEL, MATTER_PARTY_ROLES } from "@/lib/matter/practiceArea";

type Party = {
  id: string;
  role: MatterPartyRole;
  contact: { id: string; displayName: string; email: string | null; organization: string | null };
};

type ContactOption = { id: string; displayName: string; organization: string | null };

export function MatterPartiesCard({
  matterId,
  parties,
  contacts,
}: {
  matterId: string;
  parties: Party[];
  contacts: ContactOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [role, setRole] = useState<MatterPartyRole>("CLIENT");
  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addParty() {
    setBusy(true);
    setError(null);
    try {
      const payload =
        mode === "existing"
          ? { role, contactId }
          : { role, newContact: { displayName: name, email, phone, organization } };
      const res = await fetch(`/api/matters/${matterId}/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setContactId("");
      setName("");
      setEmail("");
      setPhone("");
      setOrganization("");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add party");
    } finally {
      setBusy(false);
    }
  }

  async function removeParty(partyId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/parties/${partyId}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove party");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = mode === "existing" ? Boolean(contactId) : Boolean(name.trim());

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {parties.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          {parties.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                border: "1px solid var(--sw-border)",
                borderRadius: "var(--sw-radius-sm)",
                padding: "8px 12px",
              }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>
                  {p.contact.displayName}
                  {p.contact.organization ? ` (${p.contact.organization})` : ""}
                </div>
                <div style={{ color: "var(--sw-muted)", fontSize: 12 }}>
                  {MATTER_PARTY_ROLE_LABEL[p.role]}
                  {p.contact.email ? ` · ${p.contact.email}` : ""}
                </div>
              </div>
              <button type="button" className="sw-btn sw-btnSm" disabled={busy} onClick={() => removeParty(p.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "var(--sw-muted)" }}>No parties added yet.</div>
      )}

      <div style={{ border: "1px solid var(--sw-border)", borderRadius: "var(--sw-radius-sm)", padding: 12, display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 14 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} />
            Existing contact
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
            New contact
          </label>
        </div>

        {mode === "existing" ? (
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>Contact</span>
            <select className="sw-input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">— Select a contact —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                  {c.organization ? ` (${c.organization})` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input className="sw-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="sw-input" type="email" placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input className="sw-input" type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <input className="sw-input" placeholder="Organization / firm (optional)" value={organization} onChange={(e) => setOrganization(e.target.value)} />
          </div>
        )}

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800 }}>Role</span>
          <select className="sw-input" value={role} onChange={(e) => setRole(e.target.value as MatterPartyRole)}>
            {MATTER_PARTY_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <button type="button" className="sw-btn sw-btnPrimary sw-btnSm" disabled={busy || !canAdd} onClick={addParty}>
            {busy ? "Working..." : "Add party"}
          </button>
        </div>
      </div>

      {error ? <div style={{ color: "var(--sw-danger)", fontSize: 13 }}>{error}</div> : null}
    </div>
  );
}
