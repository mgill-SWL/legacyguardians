"use client";

import { useState } from "react";

type MissingDoc = { name: string; missingTokens: string[] };

export default function GeneratePacketButton({ matterId }: { matterId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingDocs, setMissingDocs] = useState<MissingDoc[] | null>(null);

  async function generate(force: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/generate${force ? "?force=1" : ""}`, {
        method: "POST",
      });

      if (res.status === 422) {
        const body = await res.json().catch(() => null);
        setMissingDocs(body?.documentsWithMissingTokens ?? []);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.message || body?.error || `Generation failed (${res.status})`);
        return;
      }

      setMissingDocs(null);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `LG_Packet_${matterId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => generate(false)}
        style={{
          padding: "10px 12px",
          borderRadius: "var(--sw-radius-sm)",
          border: "1px solid rgba(110,231,255,0.45)",
          background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
          fontWeight: 800,
          color: "var(--sw-text)",
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Generating…" : "Generate packet (ZIP, v0)"}
      </button>

      {error ? (
        <p style={{ marginTop: 10, marginBottom: 0, color: "#f87171", fontWeight: 700 }}>{error}</p>
      ) : null}

      {missingDocs && missingDocs.length > 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid rgba(248,113,113,0.55)",
            background: "rgba(248,113,113,0.08)",
          }}
        >
          <div style={{ fontWeight: 800, color: "#f87171" }}>
            Blank fields detected — these documents are missing intake data:
          </div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {missingDocs.map((d) => (
              <li key={d.name} style={{ marginBottom: 4 }}>
                <strong>{d.name}</strong>: {d.missingTokens.join(", ")}
              </li>
            ))}
          </ul>
          <p style={{ margin: "10px 0 8px", color: "var(--sw-muted)" }}>
            The fields above will appear blank in the generated documents. Complete the intake, or
            download anyway for review.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => generate(true)}
            style={{
              padding: "8px 10px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid rgba(248,113,113,0.55)",
              background: "transparent",
              fontWeight: 800,
              color: "var(--sw-text)",
              cursor: busy ? "wait" : "pointer",
            }}
          >
            Download anyway (with blanks)
          </button>
        </div>
      ) : null}
    </div>
  );
}
