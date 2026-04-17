"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "bot"; text: string };

type Reply = { ok: boolean; reply?: string; suggestions?: { slug: string; title: string }[]; error?: string };

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [
    { role: "bot", text: "Hi, I’m the LG help bot. Ask me how to do something." },
  ]);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [open, messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", text }]);

    try {
      const res = await fetch("/api/help/reply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json().catch(() => ({}))) as Reply;
      if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);

      const botText = data.reply || "";
      setMessages((m) => [...m, { role: "bot", text: botText }]);

      if (data.suggestions?.length) {
        const s = data.suggestions.map((x) => `• ${x.title}`).join("\n");
        setMessages((m) => [...m, { role: "bot", text: `Suggested topics:\n${s}` }]);
      }
    } catch (e: any) {
      setMessages((m) => [...m, { role: "bot", text: `Error: ${e?.message || "Failed"}` }]);
    } finally {
      setBusy(false);
    }
  }

  const panel = useMemo(() => {
    if (!open) return null;
    return (
      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 86,
          width: "min(420px, calc(100vw - 36px))",
          height: "min(520px, calc(100vh - 140px))",
          borderRadius: 14,
          border: "1px solid var(--sw-border)",
          background: "var(--sw-surface)",
          color: "var(--sw-text)",
          boxShadow: "var(--sw-shadow)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          zIndex: 80,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid var(--sw-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontWeight: 900 }}>Help</div>
          <button
            onClick={() => setOpen(false)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--sw-border)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 12, overflowY: "auto", display: "grid", gap: 10 }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                justifySelf: m.role === "user" ? "end" : "start",
                maxWidth: "92%",
                whiteSpace: "pre-wrap",
                lineHeight: 1.45,
                fontSize: 13,
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid var(--sw-border)",
                background: m.role === "user" ? "rgba(29,103,184,0.10)" : "rgba(0,0,0,0.02)",
              }}
            >
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--sw-border)", display: "flex", gap: 10 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Ask a question…"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--sw-border)",
              background: "rgba(0,0,0,0.02)",
              color: "inherit",
            }}
          />
          <button
            onClick={send}
            disabled={busy}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(110,231,255,0.45)",
              background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
              fontWeight: 900,
              color: "inherit",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    );
  }, [open, messages, input, busy]);

  return (
    <>
      {panel}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          width: 56,
          height: 56,
          borderRadius: 18,
          border: "1px solid var(--sw-border)",
          background: "linear-gradient(135deg, rgba(29,103,184,0.16), rgba(14,165,233,0.10))",
          color: "inherit",
          boxShadow: "var(--sw-shadow)",
          cursor: "pointer",
          zIndex: 79,
          fontWeight: 900,
        }}
        title={open ? "Close help" : "Open help"}
        aria-label="Help"
      >
        ?
      </button>
    </>
  );
}
