"use client";

import { useState } from "react";

export function ManagementTextEditor({
  slug,
  initialTitle,
  initialContent,
  canEdit,
}: {
  slug: string;
  initialTitle: string;
  initialContent: string;
  canEdit: boolean;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/management/pages/${slug}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSaving(false);
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
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>Display text</div>
          {canEdit ? (
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(110,231,255,0.45)",
                background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
                fontWeight: 900,
                color: "inherit",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: "var(--sw-muted)" }}>Admin-only edit</div>
          )}
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            readOnly={!canEdit}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
              fontWeight: 900,
            }}
          />

          {canEdit ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              style={{
                padding: "12px 12px",
                borderRadius: 10,
                border: "1px solid var(--sw-border)",
                background: "rgba(0,0,0,0.02)",
                color: "inherit",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                fontSize: 12,
                lineHeight: 1.45,
              }}
            />
          ) : (
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{content}</div>
          )}

          {error ? <div style={{ color: "var(--sw-danger)" }}>{error}</div> : null}
          {saved ? <div style={{ color: "var(--sw-muted)", fontSize: 12 }}>Saved</div> : null}
        </div>
      </div>
    </div>
  );
}
