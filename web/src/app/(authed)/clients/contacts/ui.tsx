"use client";

import { useMemo, useState } from "react";

type Contact = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  categories: ("CLIENT" | "VENDOR" | "REFERRER")[];
  notes: string | null;
  updatedAt: string;
};

export function ContactsClient({ initialContacts }: { initialContacts: any[] }) {
  const contacts: Contact[] = (initialContacts || []).map((c) => ({
    ...c,
    updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : new Date(c.updatedAt).toISOString(),
  }));

  const [filter, setFilter] = useState<"ALL" | "CLIENT" | "VENDOR" | "REFERRER">("ALL");
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    organization: "",
    categories: { CLIENT: true, VENDOR: false, REFERRER: false },
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
          categories: cats,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
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
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          {(["CLIENT", "VENDOR", "REFERRER"] as const).map((c) => (
            <label key={c} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--sw-muted)" }}>
              <input
                type="checkbox"
                checked={(form.categories as any)[c]}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    categories: { ...f.categories, [c]: e.target.checked },
                  }))
                }
              />
              {c}
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
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="sw-input">
          <option value="ALL">All</option>
          <option value="CLIENT">Clients</option>
          <option value="VENDOR">Vendors</option>
          <option value="REFERRER">Referrers</option>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
