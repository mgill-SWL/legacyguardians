"use client";

import { useMemo, useState } from "react";

type Tpl = {
  id: string;
  key: string;
  channel: "EMAIL" | "SMS";
  name: string;
  subject: string | null;
  body: string;
  isHtml: boolean;
  attachmentUrl: string | null;
  updatedAt: string;
};

export function TemplatesClient({ initialTemplates, canEdit }: { initialTemplates: any[]; canEdit: boolean }) {
  const templates: Tpl[] = (initialTemplates || []).map((t) => ({
    ...t,
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : new Date(t.updatedAt).toISOString(),
  }));

  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id || null);
  const selected = useMemo(() => templates.find((t) => t.id === selectedId) || null, [templates, selectedId]);

  const [draft, setDraft] = useState<{ key: string; channel: "EMAIL" | "SMS"; name: string; subject: string; body: string; attachmentUrl: string; isHtml: boolean }>(
    selected
      ? {
          key: selected.key,
          channel: selected.channel,
          name: selected.name,
          subject: selected.subject || "",
          body: selected.body,
          attachmentUrl: selected.attachmentUrl || "",
          isHtml: !!selected.isHtml,
        }
      : { key: "", channel: "EMAIL", name: "", subject: "", body: "", attachmentUrl: "", isHtml: true }
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: draft.key,
          channel: draft.channel,
          name: draft.name,
          subject: draft.subject || null,
          body: draft.body,
          attachmentUrl: draft.attachmentUrl || null,
          isHtml: draft.isHtml,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: draft.key,
          channel: draft.channel,
          name: draft.name,
          subject: draft.subject || null,
          body: draft.body,
          attachmentUrl: draft.attachmentUrl || null,
          isHtml: draft.isHtml,
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
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
      <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10, alignContent: "start" }}>
        <div style={{ fontWeight: 900 }}>All templates</div>
        <div style={{ display: "grid", gap: 8 }}>
          {templates.map((t) => (
            <button
              key={t.id}
              className={`sw-navBtn ${t.id === selectedId ? "sw-navBtnActive" : ""}`}
              onClick={() => {
                setSelectedId(t.id);
                setDraft({
                  key: t.key,
                  channel: t.channel,
                  name: t.name,
                  subject: t.subject || "",
                  body: t.body,
                  attachmentUrl: t.attachmentUrl || "",
                  isHtml: !!t.isHtml,
                });
              }}
            >
              <span className="sw-navIcon">{t.channel === "SMS" ? "S" : "E"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
            </button>
          ))}
          {templates.length === 0 ? <div className="sw-muted">No templates yet.</div> : null}
        </div>
      </div>

      <div className="sw-card sw-card-pad" style={{ minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>{selected ? "Edit template" : "Create template"}</div>
          {canEdit ? (
            <button className="sw-btn sw-btnPrimary" onClick={selected ? save : create} disabled={busy}>
              {busy ? "Saving…" : selected ? "Save" : "Create"}
            </button>
          ) : (
            <div className="sw-muted" style={{ fontSize: 12 }}>Admin-only edit</div>
          )}
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {error ? <div style={{ color: "var(--sw-danger)" }}>{error}</div> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>Key</span>
              <input className="sw-input" value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))} disabled={!canEdit} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>Channel</span>
              <select className="sw-input" value={draft.channel} onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as any }))} disabled={!canEdit}>
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>Name</span>
              <input className="sw-input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} disabled={!canEdit} />
            </label>
          </div>

          {draft.channel === "EMAIL" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 10, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="sw-muted" style={{ fontSize: 12 }}>Subject</span>
                <input className="sw-input" value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} disabled={!canEdit} />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }} className="sw-muted">
                <input type="checkbox" checked={draft.isHtml} onChange={(e) => setDraft((d) => ({ ...d, isHtml: e.target.checked }))} disabled={!canEdit} />
                HTML email
              </label>
            </div>
          ) : null}

          <div style={{ display: draft.channel === "EMAIL" && draft.isHtml ? "grid" : "block", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>Body</span>
              <textarea className="sw-input" value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} disabled={!canEdit} rows={18} />
              {draft.channel === "SMS" ? (
                <div className="sw-muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {draft.body.length} characters
                </div>
              ) : null}
            </label>

            {draft.channel === "EMAIL" && draft.isHtml ? (
              <div style={{ display: "grid", gap: 6 }}>
                <span className="sw-muted" style={{ fontSize: 12 }}>Preview</span>
                <div className="sw-card sw-card-pad" style={{ background: "var(--sw-surface)", overflow: "auto", maxHeight: 420 }}>
                  <div dangerouslySetInnerHTML={{ __html: draft.body || "<em>(empty)</em>" }} />
                </div>
              </div>
            ) : null}
          </div>

          {draft.channel === "EMAIL" ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>Attachment URL (optional)</span>
              <input className="sw-input" value={draft.attachmentUrl} onChange={(e) => setDraft((d) => ({ ...d, attachmentUrl: e.target.value }))} disabled={!canEdit} />
            </label>
          ) : null}

          <div className="sw-muted" style={{ fontSize: 12 }}>
            Template variables (v1): use <code>{"{{client_name}}"}</code>, <code>{"{{start_time}}"}</code>, <code>{"{{phone}}"}</code>. We’ll expand this as we wire automations.
          </div>
        </div>
      </div>
    </div>
  );
}
