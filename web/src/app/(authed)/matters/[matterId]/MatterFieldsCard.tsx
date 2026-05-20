"use client";

import { FormEvent, useState } from "react";

type Field = {
  id: string;
  key: string;
  label: string;
  type: string;
  helpText: string | null;
  required: boolean;
  options: string[];
  lookupTarget: string | null;
};

type UserOption = { id: string; name: string | null; email: string | null };

type ContactOption = { id: string; displayName: string; email: string | null };

function displayUser(u: UserOption) {
  return u.name || u.email || u.id;
}

function initialString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function MatterFieldsCard({
  matterId,
  fields,
  values,
  users,
  contacts,
}: {
  matterId: string;
  fields: Field[];
  values: Record<string, unknown>;
  users: UserOption[];
  contacts: ContactOption[];
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) init[f.key] = values[f.key] ?? (f.type === "MULTI_SELECT_PICKLIST" ? [] : "");
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/fields`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values: draft }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save matter fields");
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save matter fields");
    } finally {
      setSaving(false);
    }
  }

  function setValue(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function renderField(f: Field) {
    const common = { className: "sw-input" };
    const value = draft[f.key];
    if (f.type === "LONG_TEXT") return <textarea {...common} rows={3} value={initialString(value)} onChange={(e) => setValue(f.key, e.target.value)} />;
    if (f.type === "DATE") return <input {...common} type="date" value={initialString(value)} onChange={(e) => setValue(f.key, e.target.value)} />;
    if (f.type === "CURRENCY") return <input {...common} inputMode="decimal" value={value === null || value === undefined || value === "" ? "" : String(Number(value) / 100)} onChange={(e) => setValue(f.key, e.target.value)} />;
    if (f.type === "NUMBER") return <input {...common} inputMode="decimal" value={initialString(value)} onChange={(e) => setValue(f.key, e.target.value)} />;
    if (f.type === "TRUE_FALSE") {
      return (
        <select {...common} value={value === true ? "true" : value === false ? "false" : ""} onChange={(e) => setValue(f.key, e.target.value)}>
          <option value="">—</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }
    if (f.type === "PICKLIST") {
      return <select {...common} value={initialString(value)} onChange={(e) => setValue(f.key, e.target.value)}><option value="">—</option>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>;
    }
    if (f.type === "MULTI_SELECT_PICKLIST") {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <select {...common} multiple value={selected} onChange={(e) => setValue(f.key, Array.from(e.target.selectedOptions).map((o) => o.value))}>
          {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.type === "USER") return <select {...common} value={initialString(value)} onChange={(e) => setValue(f.key, e.target.value)}><option value="">—</option>{users.map((u) => <option key={u.id} value={u.id}>{displayUser(u)}</option>)}</select>;
    if (f.type === "CONTACT") return <select {...common} value={initialString(value)} onChange={(e) => setValue(f.key, e.target.value)}><option value="">—</option>{contacts.map((c) => <option key={c.id} value={c.id}>{c.displayName}{c.email ? ` • ${c.email}` : ""}</option>)}</select>;
    return <input {...common} value={initialString(value)} onChange={(e) => setValue(f.key, e.target.value)} placeholder={f.lookupTarget ? `Lookup: ${f.lookupTarget}` : undefined} />;
  }

  return (
    <section style={{ marginTop: 18, padding: 18, borderRadius: "var(--sw-radius)", background: "var(--sw-card)", border: "1px solid var(--sw-border)" }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>Custom matter fields</div>
      {fields.length ? (
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 10 }}>
            {fields.map((f) => (
              <label key={f.id} style={{ display: "grid", gap: 6 }}>
                <span className="sw-muted" style={{ fontSize: 12, fontWeight: 900 }}>{f.label}{f.required ? " *" : ""}</span>
                {renderField(f)}
                {f.helpText ? <span className="sw-muted" style={{ fontSize: 11 }}>{f.helpText}</span> : null}
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="sw-btn" disabled={saving}>{saving ? "Saving…" : "Save custom fields"}</button>
            {saved ? <span className="sw-muted" style={{ fontSize: 12 }}>Saved</span> : null}
            {error ? <span style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</span> : null}
          </div>
        </form>
      ) : <div className="sw-muted">No custom matter fields configured yet.</div>}
    </section>
  );
}
