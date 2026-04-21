"use client";

import { useMemo, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export function SupportChat() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi! Ask me about the estate planning process, parking directions, or how our pricing features work. I’ll answer using the Help Topics + Pricing catalogs.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);

  async function send() {
    const text = input.trim();
    if (!text) return;

    setError(null);
    setBusy(true);
    setInput("");

    const next = [...messages, { role: "user", content: text } as Msg];
    setMessages(next);

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: data.message || "(no response)" }]);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sw-card" style={{ marginTop: 16, overflow: "hidden" }}>
      <div style={{ maxHeight: 520, overflow: "auto", padding: 16, display: "grid", gap: 12 }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ display: "grid", justifyItems: m.role === "user" ? "end" : "start" }}>
            <div
              style={{
                maxWidth: 720,
                padding: "10px 12px",
                borderRadius: 12,
                background: m.role === "user" ? "var(--sw-surface2)" : "var(--sw-surface)",
                border: `1px solid var(--sw-border)`,
                whiteSpace: "pre-wrap",
                lineHeight: 1.35,
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy ? <div className="sw-muted">Thinking…</div> : null}
        {error ? <div style={{ color: "var(--sw-danger)" }}>{error}</div> : null}
      </div>

      <div style={{ borderTop: "1px solid var(--sw-border)", padding: 12, display: "flex", gap: 8 }}>
        <input
          className="sw-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) send();
            }
          }}
          disabled={busy}
        />
        <button className="sw-btn sw-btnPrimary" onClick={send} disabled={!canSend}>
          Send
        </button>
      </div>
    </div>
  );
}
