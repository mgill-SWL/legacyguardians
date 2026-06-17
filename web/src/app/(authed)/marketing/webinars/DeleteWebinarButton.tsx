"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteWebinarButton({
  id,
  name,
  registrations,
}: {
  id: string;
  name: string;
  registrations: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Delete "${name}"? This removes the webinar and frees its slug. Only empty webinars can be deleted.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketing/webinars/${id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete webinar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 4, justifyItems: "end" }}>
      <button
        type="button"
        className="sw-btn sw-btnSm"
        onClick={remove}
        disabled={busy || registrations > 0}
        title={registrations > 0 ? "Webinars with registrations can't be deleted" : "Delete this webinar"}
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error ? (
        <span style={{ color: "var(--sw-danger)", fontSize: 12, fontWeight: 600, maxWidth: 280, textAlign: "right" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
