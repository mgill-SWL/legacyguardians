"use client";

import { useMemo, useState } from "react";

type Article = {
  id: string;
  slug: string;
  title: string;
  format: "MARKDOWN" | "HTML" | "PLAINTEXT";
  body: string;
  tags: string[];
  published: boolean;
  sortOrder: number;
};

export function HelpTopicsClient({ initialArticles, canEdit }: { initialArticles: any[]; canEdit: boolean }) {
  const articles: Article[] = initialArticles || [];
  const [selectedId, setSelectedId] = useState<string | null>(articles[0]?.id || null);

  const selected = useMemo(() => articles.find((a) => a.id === selectedId) || null, [articles, selectedId]);

  const [draft, setDraft] = useState(() =>
    selected
      ? {
          slug: selected.slug,
          title: selected.title,
          format: selected.format,
          body: selected.body,
          tags: (selected.tags || []).join(", "),
          published: !!selected.published,
          sortOrder: selected.sortOrder ?? 0,
        }
      : { slug: "", title: "", format: "MARKDOWN" as const, body: "", tags: "", published: true, sortOrder: 0 }
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadArticle(a: Article) {
    setSelectedId(a.id);
    setDraft({
      slug: a.slug,
      title: a.title,
      format: a.format,
      body: a.body,
      tags: (a.tags || []).join(", "),
      published: !!a.published,
      sortOrder: a.sortOrder ?? 0,
    });
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/help-articles/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: draft.slug,
          title: draft.title,
          format: draft.format,
          body: draft.body,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          published: draft.published,
          sortOrder: Number(draft.sortOrder) || 0,
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
      const res = await fetch(`/api/help-articles`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: draft.slug,
          title: draft.title,
          format: draft.format,
          body: draft.body,
          tags: draft.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          published: draft.published,
          sortOrder: Number(draft.sortOrder) || 0,
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

  async function del() {
    if (!selected) return;
    if (!confirm(`Delete help topic "${selected.title}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/help-articles/${selected.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  const previewHtml = useMemo(() => {
    if (draft.format === "HTML") return draft.body;
    if (draft.format === "PLAINTEXT") return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(draft.body)}</pre>`;
    // MARKDOWN preview later (we'll keep it simple for v1)
    return `<pre style="white-space:pre-wrap;margin:0">${escapeHtml(draft.body)}</pre>`;
  }, [draft.body, draft.format]);

  return (
    <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
      <div className="sw-card" style={{ overflow: "hidden" }}>
        <div className="sw-card-pad" style={{ display: "grid", gap: 10, borderBottom: "1px solid var(--sw-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 900 }}>Topics</div>
            {canEdit ? (
              <button
                className="sw-btn"
                onClick={() => {
                  setSelectedId(null);
                  setDraft({ slug: "", title: "", format: "MARKDOWN", body: "", tags: "", published: true, sortOrder: 0 });
                }}
              >
                New
              </button>
            ) : null}
          </div>
          <div className="sw-muted" style={{ fontSize: 12 }}>
            Click a topic to view/edit.
          </div>
        </div>

        <div style={{ maxHeight: 520, overflow: "auto" }}>
          {articles.map((a) => (
            <button
              key={a.id}
              className="sw-listItem"
              onClick={() => loadArticle(a)}
              style={{
                width: "100%",
                textAlign: "left",
                background: a.id === selectedId ? "var(--sw-surface2)" : "transparent",
                border: 0,
                borderBottom: "1px solid var(--sw-border)",
                padding: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 800 }}>{a.title}</div>
              <div className="sw-muted" style={{ fontSize: 12 }}>
                {a.slug}
              </div>
            </button>
          ))}
          {articles.length === 0 ? <div className="sw-card-pad sw-muted">No help topics yet.</div> : null}
        </div>
      </div>

      <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>{selected ? "Edit topic" : "New topic"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            {canEdit ? (
              <button className="sw-btn sw-btnPrimary" onClick={selected ? save : create} disabled={busy}>
                {selected ? "Save" : "Create"}
              </button>
            ) : null}
            {canEdit && selected ? (
              <button className="sw-btn" onClick={del} disabled={busy}>
                Delete
              </button>
            ) : null}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Title
            </span>
            <input className="sw-input" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} disabled={!canEdit} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Slug
            </span>
            <input className="sw-input" value={draft.slug} onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))} disabled={!canEdit} placeholder="e.g., rep-overview" />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Tags (comma separated)
            </span>
            <input className="sw-input" value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} disabled={!canEdit} />
          </label>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12 }}>
                Format
              </span>
              <select className="sw-input" value={draft.format} onChange={(e) => setDraft((d) => ({ ...d, format: e.target.value as any }))} disabled={!canEdit}>
                <option value="MARKDOWN">MARKDOWN</option>
                <option value="HTML">HTML</option>
                <option value="PLAINTEXT">PLAINTEXT</option>
              </select>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 22 }} className="sw-muted">
              <input type="checkbox" checked={draft.published} onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))} disabled={!canEdit} />
              Published
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Body
            </span>
            <textarea className="sw-input" rows={18} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} disabled={!canEdit} />
          </label>
          <div style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12 }}>
              Preview
            </span>
            <div className="sw-card sw-card-pad" style={{ maxHeight: 460, overflow: "auto" }}>
              <div dangerouslySetInnerHTML={{ __html: previewHtml || "<em>(empty)</em>" }} />
            </div>
          </div>
        </div>

        {error ? <div style={{ color: "var(--sw-danger)" }}>{error}</div> : null}
        {!canEdit ? <div className="sw-muted">Admin-only edit.</div> : null}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
