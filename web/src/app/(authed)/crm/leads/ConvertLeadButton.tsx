"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function convert() {
    if (!confirm("Mark RA signed and convert this lead into a Client Contact + Matter?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/convert`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button
        onClick={convert}
        disabled={busy}
        style={{
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(110,231,255,0.45)",
          background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
          fontWeight: 900,
          color: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {busy ? "Converting…" : "Convert"}
      </button>
      {error ? <div style={{ fontSize: 12, color: "var(--sw-danger)" }}>{error}</div> : null}
    </div>
  );
}
