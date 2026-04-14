"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function Composer({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ringcentral/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, text: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `Send failed (${res.status})`);
      }
      setText("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--sw-border, rgba(255,255,255,0.12))", paddingTop: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a reply…"
          rows={3}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
            background: "rgba(255,255,255,0.03)",
            color: "inherit",
            resize: "vertical",
          }}
        />
        <button
          onClick={send}
          disabled={busy || !text.trim()}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(110,231,255,0.45)",
            background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
            fontWeight: 900,
            cursor: busy ? "not-allowed" : "pointer",
            color: "inherit",
          }}
        >
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error ? <div style={{ marginTop: 8, color: "#ffb4b4" }}>{error}</div> : null}
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
        MVP: SMS only. MMS and templates next.
      </div>
    </div>
  );
}
