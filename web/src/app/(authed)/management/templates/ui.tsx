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
  updatedAt: string | Date;
};

type Draft = { key: string; channel: "EMAIL" | "SMS"; name: string; subject: string; body: string; attachmentUrl: string; isHtml: boolean };

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Failed";
}

function emptyDraft(): Draft {
  return { key: "", channel: "EMAIL", name: "", subject: "", body: "", attachmentUrl: "", isHtml: true };
}

function draftFromTemplate(template: Tpl): Draft {
  return {
    key: template.key,
    channel: template.channel,
    name: template.name,
    subject: template.subject || "",
    body: template.body,
    attachmentUrl: template.attachmentUrl || "",
    isHtml: !!template.isHtml,
  };
}

export function TemplatesClient({ initialTemplates, canEdit, canDelete }: { initialTemplates: Tpl[]; canEdit: boolean; canDelete: boolean }) {
  const [templates, setTemplates] = useState<(Tpl & { updatedAt: string })[]>(() =>
    (initialTemplates || []).map((t) => ({
      ...t,
      updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : new Date(t.updatedAt).toISOString(),
    }))
  );

  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id || null);
  const selected = useMemo(() => templates.find((t) => t.id === selectedId) || null, [templates, selectedId]);

  const [draft, setDraft] = useState<Draft>(selected ? draftFromTemplate(selected) : emptyDraft());

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
      const updatedAt = new Date().toISOString();
      setTemplates((items) =>
        items.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                key: draft.key.trim(),
                channel: draft.channel,
                name: draft.name.trim(),
                subject: draft.subject || null,
                body: draft.body,
                attachmentUrl: draft.attachmentUrl || null,
                isHtml: draft.isHtml,
                updatedAt,
              }
            : item
        )
      );
    } catch (e: unknown) {
      setError(errorMessage(e));
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
      if (!res.ok || data.ok === false || !data.id) throw new Error(data.error || `HTTP ${res.status}`);
      const updatedAt = new Date().toISOString();
      const created: Tpl & { updatedAt: string } = {
        id: data.id,
        key: draft.key.trim(),
        channel: draft.channel,
        name: draft.name.trim(),
        subject: draft.subject || null,
        body: draft.body,
        attachmentUrl: draft.attachmentUrl || null,
        isHtml: draft.isHtml,
        updatedAt,
      };
      setTemplates((items) => [created, ...items]);
      setSelectedId(created.id);
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function moveTemplate(id: string, direction: "up" | "down") {
    const index = templates.findIndex((template) => template.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || !templates[swapIndex]) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${id}/move`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);

      setTemplates((items) => {
        const next = [...items];
        const current = next[index];
        const swap = next[swapIndex];
        next[index] = swap;
        next[swapIndex] = current;
        return next;
      });
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(template: Tpl) {
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);

      setTemplates((items) => {
        const next = items.filter((item) => item.id !== template.id);
        if (selectedId === template.id) {
          const replacement = next[0] || null;
          setSelectedId(replacement?.id || null);
          setDraft(replacement ? draftFromTemplate(replacement) : emptyDraft());
        }
        return next;
      });
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "400px minmax(0, 1fr)", gap: 12 }}>
      <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10, alignContent: "start", minWidth: 0 }}>
        <div style={{ fontWeight: 900 }}>All templates</div>
        {canEdit ? (
          <button
            className="sw-btn sw-btnPrimary"
            type="button"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => {
              setSelectedId(null);
              setDraft(emptyDraft());
              setError(null);
            }}
          >
            New
          </button>
        ) : null}
        <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
          {templates.map((t, index) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: canEdit || canDelete ? "minmax(0, 1fr) auto" : "1fr",
                gap: 6,
                alignItems: "center",
                minWidth: 0,
              }}
            >
              <button
                className={`sw-navBtn ${t.id === selectedId ? "sw-navBtnActive" : ""}`}
                style={{ minWidth: 0 }}
                onClick={() => {
                  setSelectedId(t.id);
                  setDraft(draftFromTemplate(t));
                  setError(null);
                }}
              >
                <span className="sw-navIcon" style={{ flexShrink: 0 }}>{t.channel === "SMS" ? "S" : "E"}</span>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
              </button>
              {canEdit || canDelete ? (
                <span style={{ display: "inline-flex", gap: 4 }}>
                  {canEdit ? (
                    <>
                      <button className="sw-btn sw-btnSm" type="button" disabled={busy || index === 0} onClick={() => moveTemplate(t.id, "up")} aria-label={`Move ${t.name} up`}>
                        ↑
                      </button>
                      <button
                        className="sw-btn sw-btnSm"
                        type="button"
                        disabled={busy || index === templates.length - 1}
                        onClick={() => moveTemplate(t.id, "down")}
                        aria-label={`Move ${t.name} down`}
                      >
                        ↓
                      </button>
                    </>
                  ) : null}
                  {canDelete ? (
                    <button className="sw-btn sw-btnSm" type="button" disabled={busy} onClick={() => deleteTemplate(t)} aria-label={`Delete ${t.name}`} style={{ color: "var(--sw-danger)" }}>
                      Delete
                    </button>
                  ) : null}
                </span>
              ) : null}
            </div>
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
            <div className="sw-muted" style={{ fontSize: 12 }}>Sign in with an active firm to edit</div>
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
              <select className="sw-input" value={draft.channel} onChange={(e) => setDraft((d) => ({ ...d, channel: e.target.value as Draft["channel"] }))} disabled={!canEdit}>
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
