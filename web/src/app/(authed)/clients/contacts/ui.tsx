"use client";

import { useMemo, useState } from "react";

type Contact = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  categories: ContactCategory[];
  professionalType: ProfessionalType | null;
  referralSourceStatus: ReferralSourceStatus | null;
  relationshipOwnerId: string | null;
  relationshipOwner: UserOption | null;
  notes: string | null;
  updatedAt: string;
};

type ContactCategory = "CLIENT" | "VENDOR" | "REFERRER" | "PROFESSIONAL_ADVISOR" | "GENERAL";
type ProfessionalType = "FINANCIAL_ADVISOR" | "CPA" | "INSURANCE" | "BANKER" | "REALTOR" | "CARE_MANAGER" | "ATTORNEY" | "OTHER";
type ReferralSourceStatus = "PROSPECT" | "ACTIVE" | "INACTIVE";
type UserOption = { id: string; name: string | null; email: string | null };

const CATEGORY_OPTIONS: Array<{ value: ContactCategory; label: string }> = [
  { value: "CLIENT", label: "Client" },
  { value: "VENDOR", label: "Vendor" },
  { value: "REFERRER", label: "Referrer" },
  { value: "PROFESSIONAL_ADVISOR", label: "Professional advisor" },
  { value: "GENERAL", label: "General contact" },
];

const PROFESSIONAL_TYPE_OPTIONS: Array<{ value: ProfessionalType; label: string }> = [
  { value: "FINANCIAL_ADVISOR", label: "Financial advisor" },
  { value: "CPA", label: "CPA" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "BANKER", label: "Banker" },
  { value: "REALTOR", label: "Realtor" },
  { value: "CARE_MANAGER", label: "Care manager" },
  { value: "ATTORNEY", label: "Attorney" },
  { value: "OTHER", label: "Other" },
];

const REFERRAL_STATUS_OPTIONS: Array<{ value: ReferralSourceStatus; label: string }> = [
  { value: "PROSPECT", label: "Prospect" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

function displayUser(u: UserOption | null | undefined) {
  if (!u) return "";
  return u.name || u.email || u.id;
}

function enumLabel<T extends string>(options: Array<{ value: T; label: string }>, value: T | null) {
  if (!value) return "";
  return options.find((o) => o.value === value)?.label || value;
}

type InitialContact = Omit<Contact, "updatedAt"> & { updatedAt: string | Date };

export function ContactsClient({ initialContacts, users }: { initialContacts: InitialContact[]; users: UserOption[] }) {
  const contacts: Contact[] = (initialContacts || []).map((c) => ({
    ...c,
    updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : new Date(c.updatedAt).toISOString(),
  }));

  const [filter, setFilter] = useState<"ALL" | ContactCategory>("ALL");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    organization: "",
    categories: { CLIENT: false, VENDOR: false, REFERRER: false, PROFESSIONAL_ADVISOR: false, GENERAL: true } as Record<ContactCategory, boolean>,
    professionalType: "" as "" | ProfessionalType,
    referralSourceStatus: "" as "" | ReferralSourceStatus,
    relationshipOwnerId: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter !== "ALL" && !c.categories.includes(filter)) return false;
      if (!qq) return true;
      return (
        c.displayName.toLowerCase().includes(qq) ||
        (c.email || "").toLowerCase().includes(qq) ||
        (c.phone || "").toLowerCase().includes(qq) ||
        (c.organization || "").toLowerCase().includes(qq)
      );
    });
  }, [contacts, filter, q]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const cats = Object.entries(form.categories)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          organization: form.organization.trim() || null,
          categories: cats.length ? cats : ["GENERAL"],
          professionalType: form.professionalType || null,
          referralSourceStatus: form.referralSourceStatus || null,
          relationshipOwnerId: form.relationshipOwnerId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
      <div
        style={{
          border: "1px solid var(--sw-border)",
          borderRadius: 14,
          padding: 16,
          background: "var(--sw-card)",
          maxWidth: 900,
        }}
      >
        <div style={{ fontWeight: 900 }}>Add contact</div>
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <input
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="Name"
            className="sw-input"
          />
          <input
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Email"
            className="sw-input"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Phone"
            className="sw-input"
          />
          <input
            value={form.organization}
            onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
            placeholder="Organization"
            className="sw-input"
          />
          <select className="sw-input" value={form.professionalType} onChange={(e) => setForm((f) => ({ ...f, professionalType: e.target.value as typeof form.professionalType }))}>
            <option value="">Professional type — optional</option>
            {PROFESSIONAL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="sw-input" value={form.referralSourceStatus} onChange={(e) => setForm((f) => ({ ...f, referralSourceStatus: e.target.value as typeof form.referralSourceStatus }))}>
            <option value="">Referral status — optional</option>
            {REFERRAL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="sw-input" value={form.relationshipOwnerId} onChange={(e) => setForm((f) => ({ ...f, relationshipOwnerId: e.target.value }))}>
            <option value="">Relationship owner — optional</option>
            {users.map((u) => <option key={u.id} value={u.id}>{displayUser(u)}</option>)}
          </select>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          {CATEGORY_OPTIONS.map((category) => (
            <label key={category.value} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--sw-muted)" }}>
              <input
                type="checkbox"
                checked={form.categories[category.value]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    categories: { ...f.categories, [category.value]: e.target.checked },
                  }))
                }
              />
              {category.label}
            </label>
          ))}

          <button onClick={create} disabled={busy || !form.displayName.trim()} className="sw-btn sw-btnPrimary">
            {busy ? "Saving…" : "Create"}
          </button>
          {error ? <span style={{ fontSize: 12, color: "var(--sw-danger)" }}>{error}</span> : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contacts…"
          className="sw-input"
          style={{ minWidth: 260 }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as "ALL" | ContactCategory)} className="sw-input">
          <option value="ALL">All</option>
          {CATEGORY_OPTIONS.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
        </select>
        <div style={{ fontSize: 12, color: "var(--sw-muted)" }}>{filtered.length} shown</div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="sw-table">
          <thead>
            <tr>
              <th className="sw-th">Name</th>
              <th className="sw-th">Categories</th>
              <th className="sw-th">Email</th>
              <th className="sw-th">Phone</th>
              <th className="sw-th">Organization</th>
              <th className="sw-th">Professional type</th>
              <th className="sw-th">Referral status</th>
              <th className="sw-th">Relationship owner</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="sw-tr">
                <td className="sw-td" style={{ fontWeight: 900 }}>{c.displayName}</td>
                <td className="sw-td" style={{ fontSize: 12, color: "var(--sw-muted)" }}>{c.categories.join(", ")}</td>
                <td className="sw-td">{c.email || ""}</td>
                <td className="sw-td">{c.phone || ""}</td>
                <td className="sw-td">{c.organization || ""}</td>
                <td className="sw-td">{enumLabel(PROFESSIONAL_TYPE_OPTIONS, c.professionalType)}</td>
                <td className="sw-td">{enumLabel(REFERRAL_STATUS_OPTIONS, c.referralSourceStatus)}</td>
                <td className="sw-td">{displayUser(c.relationshipOwner)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
