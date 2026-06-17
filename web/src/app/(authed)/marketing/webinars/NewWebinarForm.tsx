"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function NewWebinarForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [evergreen, setEvergreen] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(name);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/marketing/webinars", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          slug: effectiveSlug,
          evergreen,
          startsAt: evergreen ? undefined : startsAt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage("Webinar created.");
      setName("");
      setSlug("");
      setSlugEdited(false);
      setStartsAt("");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create webinar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Webinar name</span>
        <input
          className="sw-input"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Free Estate Planning Webinar"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <span>Slug (used in the embed URL and for reporting)</span>
        <input
          className="sw-input"
          value={effectiveSlug}
          onChange={(e) => {
            setSlug(slugify(e.target.value));
            setSlugEdited(true);
          }}
          placeholder="free-estate-planning-webinar"
        />
      </label>

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={evergreen} onChange={(e) => setEvergreen(e.target.checked)} />
        <span>Evergreen (always-on, no fixed date)</span>
      </label>

      {!evergreen ? (
        <label style={{ display: "grid", gap: 6 }}>
          <span>Date &amp; time</span>
          <input
            className="sw-input"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
      ) : null}

      {error ? <div style={{ color: "var(--sw-danger)", fontWeight: 700 }}>{error}</div> : null}
      {message ? <div style={{ color: "#16a34a", fontWeight: 700 }}>{message}</div> : null}

      <div>
        <button type="submit" className="sw-btn sw-btnPrimary" disabled={busy || !name.trim()}>
          {busy ? "Creating…" : "Create webinar"}
        </button>
      </div>
    </form>
  );
}
