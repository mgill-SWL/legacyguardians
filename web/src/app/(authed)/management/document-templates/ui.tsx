"use client";

import { FormEvent, useMemo, useState } from "react";

type Kind = "REPRESENTATION_AGREEMENT" | "HR_DOCUMENT" | "CONSENT" | "AUTHORIZATION" | "ACKNOWLEDGEMENT";

type Template = {
  id: string;
  key: string;
  name: string;
  kind: Kind;
  description: string | null;
  sourceFileName: string;
  mimeType: string;
  sizeBytes: number;
  active: boolean;
  updatedAt: string;
  createdByLabel: string | null;
};

type DocumensoStatus = {
  configured: boolean;
  ok: boolean;
  baseUrl: string;
  error?: string;
};

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "REPRESENTATION_AGREEMENT", label: "Representation agreement" },
  { value: "HR_DOCUMENT", label: "HR document" },
  { value: "CONSENT", label: "Consent" },
  { value: "AUTHORIZATION", label: "Authorization" },
  { value: "ACKNOWLEDGEMENT", label: "Non-notary acknowledgement" },
];

function bytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function kindLabel(kind: Kind) {
  return KIND_OPTIONS.find((option) => option.value === kind)?.label || kind;
}

function defaultKey(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Request failed";
}

export function DocumentTemplatesClient({
  initialTemplates,
  initialDocumensoStatus,
  canEdit,
}: {
  initialTemplates: Template[];
  initialDocumensoStatus: DocumensoStatus;
  canEdit: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [documensoStatus, setDocumensoStatus] = useState(initialDocumensoStatus);
  const [kind, setKind] = useState<Kind>("REPRESENTATION_AGREEMENT");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingDocumenso, setCheckingDocumenso] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const representationAgreements = useMemo(
    () => templates.filter((template) => template.kind === "REPRESENTATION_AGREEMENT" && template.active),
    [templates]
  );

  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      if (!file) throw new Error("Choose a template file first.");
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      form.set("name", name.trim() || file.name.replace(/\.[^.]+$/, ""));
      form.set("key", key.trim() || defaultKey(name || file.name));
      form.set("description", description.trim());

      const res = await fetch("/api/document-templates", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || data.ok === false || !data.id) throw new Error(data.error || `HTTP ${res.status}`);

      setMessage("Template uploaded.");
      window.location.reload();
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function setActive(template: Template, active: boolean) {
    if (!canEdit) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/document-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setTemplates((items) => items.map((item) => (item.id === template.id ? { ...item, active } : item)));
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate(template: Template) {
    if (!canEdit) return;
    const confirmed = window.confirm(`Delete "${template.name}"? This removes the uploaded file from the template library.`);
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/document-templates/${template.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setTemplates((items) => items.filter((item) => item.id !== template.id));
      setMessage("Template deleted.");
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkDocumenso() {
    setCheckingDocumenso(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/documenso/status", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<DocumensoStatus> & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDocumensoStatus({
        configured: Boolean(data.configured),
        ok: Boolean(data.ok),
        baseUrl: data.baseUrl || "https://app.documenso.com/api/v2",
        error: data.error,
      });
      setMessage(data.ok ? "Documenso connection verified." : "Documenso setup still needs attention.");
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setCheckingDocumenso(false);
    }
  }

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      <div className="sw-card sw-card-pad" style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950 }}>Representation agreements</div>
            <div className="sw-muted" style={{ marginTop: 4, fontSize: 12 }}>
              Active RA templates available for the lead-to-signature workflow.
            </div>
          </div>
          <div style={{ fontWeight: 950, fontSize: 28 }}>{representationAgreements.length}</div>
        </div>
      </div>

      <div
        className="sw-card sw-card-pad"
        style={{
          display: "grid",
          gap: 12,
          borderColor: documensoStatus.ok ? "rgba(34, 197, 94, 0.35)" : "rgba(168, 116, 68, 0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 950 }}>Documenso</div>
            <div className="sw-muted" style={{ marginTop: 4, fontSize: 12 }}>
              {documensoStatus.ok
                ? "Connection verified. Generated PDFs can be created as Documenso envelopes."
                : documensoStatus.configured
                  ? "API token is configured, but Documenso did not respond cleanly."
                  : "Add DOCUMENSO_API_TOKEN before sending agreements for signature."}
            </div>
          </div>
          <span className="sw-badge">{documensoStatus.ok ? "Ready" : "Setup needed"}</span>
        </div>
        <div className="sw-muted" style={{ fontSize: 12 }}>
          Base URL: <span style={{ fontFamily: "var(--sw-mono)" }}>{documensoStatus.baseUrl}</span>
          {documensoStatus.error ? <> · {documensoStatus.error}</> : null}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 13 }}>Start here</div>
          <ol className="sw-muted" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 12 }}>
            <li>Create or log in to the Documenso workspace that will own Speedwell signature packets.</li>
            <li>Create an API token from Documenso Settings and copy it immediately.</li>
            <li>Add <span style={{ fontFamily: "var(--sw-mono)" }}>DOCUMENSO_API_TOKEN</span> in Vercel and local env. Leave the base URL alone unless self-hosting.</li>
            <li>Use Legacy Guardians merge placeholders in source templates. Add Documenso signature/date fields only to the PDF/signing packet before sending.</li>
          </ol>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="sw-btn sw-btnSm" type="button" disabled={checkingDocumenso} onClick={checkDocumenso}>
            {checkingDocumenso ? "Checking..." : "Check connection"}
          </button>
          <a className="sw-btn sw-btnSm" href="https://docs.documenso.com/docs/developers/getting-started/authentication" target="_blank" rel="noreferrer">
            API token docs
          </a>
        </div>
      </div>

      {canEdit ? (
        <form className="sw-card sw-card-pad" onSubmit={upload} style={{ display: "grid", gap: 12, maxWidth: 920 }}>
          <div>
            <div style={{ fontWeight: 950 }}>Upload template</div>
            <div className="sw-muted" style={{ marginTop: 4, fontSize: 12 }}>
              Upload the editable source template here. Use Legacy Guardians merge placeholders for document data; Documenso signature fields belong in the signing packet/PDF step.
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12, fontWeight: 800 }}>Kind</span>
              <select className="sw-input" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12, fontWeight: 800 }}>Name</span>
              <input className="sw-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Speedwell EP Representation Agreement" />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span className="sw-muted" style={{ fontSize: 12, fontWeight: 800 }}>Key</span>
              <input className="sw-input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="speedwell-ep-ra" />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12, fontWeight: 800 }}>Description</span>
            <textarea className="sw-input" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="sw-muted" style={{ fontSize: 12, fontWeight: 800 }}>Template file</span>
            <input
              className="sw-file"
              type="file"
              accept=".docx,.pdf,.doc,.html,.htm,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
              onChange={(e) => {
                const next = e.target.files?.[0] || null;
                setFile(next);
                if (next && !name) setName(next.name.replace(/\.[^.]+$/, ""));
                if (next && !key) setKey(defaultKey(next.name));
              }}
            />
          </label>

          <button className="sw-btn sw-btnPrimary" type="submit" disabled={busy} style={{ width: "fit-content" }}>
            {busy ? "Uploading..." : "Upload template"}
          </button>

          {message ? <div className="sw-muted" style={{ fontSize: 12 }}>{message}</div> : null}
          {error ? <div style={{ color: "var(--sw-danger)", fontSize: 12 }}>{error}</div> : null}
        </form>
      ) : null}

      <div className="sw-card sw-card-pad" style={{ overflowX: "auto" }}>
        <div style={{ fontWeight: 950 }}>Template library</div>
        <table className="sw-table" style={{ marginTop: 12, minWidth: 900 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Kind</th>
              <th>Key</th>
              <th>File</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>
                  <div style={{ fontWeight: 900 }}>{template.name}</div>
                  {template.description ? <div className="sw-muted" style={{ marginTop: 4, fontSize: 12 }}>{template.description}</div> : null}
                </td>
                <td>{kindLabel(template.kind)}</td>
                <td style={{ fontFamily: "var(--sw-mono)" }}>{template.key}</td>
                <td>
                  <div>{template.sourceFileName}</div>
                  <div className="sw-muted" style={{ marginTop: 4, fontSize: 12 }}>{bytes(template.sizeBytes)}</div>
                </td>
                <td>{template.active ? "Active" : "Inactive"}</td>
                <td>{template.updatedAt.slice(0, 10)}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a className="sw-btn sw-btnSm" href={`/api/document-templates/${template.id}/download`}>Download</a>
                    {canEdit ? (
                      <button className="sw-btn sw-btnSm" type="button" disabled={busy} onClick={() => setActive(template, !template.active)}>
                        {template.active ? "Deactivate" : "Activate"}
                      </button>
                    ) : null}
                    {canEdit ? (
                      <button className="sw-btn sw-btnSm" type="button" disabled={busy} onClick={() => deleteTemplate(template)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {templates.length === 0 ? (
              <tr>
                <td className="sw-muted" colSpan={7} style={{ padding: 14 }}>
                  No document templates uploaded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
