"use client";

import { useMemo, useState } from "react";

export function PortalClient({ initialEmail }: { initialEmail?: string | null }) {
  const [step, setStep] = useState<"email" | "code">(initialEmail ? "code" : "email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string>("");

  const canSend = useMemo(() => email.trim().includes("@"), [email]);
  const canVerify = useMemo(() => /^[0-9]{6}$/.test(code.trim()), [code]);

  async function sendCode() {
    setStatus("Sending code…");
    const res = await fetch("/api/portal/request-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setStatus(`Error (${res.status})`);
      return;
    }
    setStep("code");
    setStatus("Code sent. Check your email.");
  }

  async function verify() {
    setStatus("Verifying…");
    const res = await fetch("/api/portal/verify-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    if (!res.ok) {
      setStatus("Invalid code.");
      return;
    }
    setStatus("Success. Loading…");
    window.location.reload();
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "44px 18px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>Secure client portal</h1>
      <p style={{ marginTop: 10, color: "var(--sw-muted)" }}>
        Enter your email to receive a 6-digit access code.
      </p>

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "var(--sw-muted)" }}>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--sw-text)",
              outline: "none",
            }}
          />
        </label>

        {step === "email" ? (
          <button
            type="button"
            onClick={sendCode}
            disabled={!canSend}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid rgba(110,231,255,0.45)",
              background:
                "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
              fontWeight: 800,
              color: "var(--sw-text)",
              cursor: canSend ? "pointer" : "not-allowed",
              opacity: canSend ? 1 : 0.6,
            }}
          >
            Send code
          </button>
        ) : (
          <>
            <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
              <span style={{ color: "var(--sw-muted)" }}>6-digit code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                placeholder="123456"
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--sw-radius-sm)",
                  border: "1px solid var(--sw-border)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--sw-text)",
                  outline: "none",
                  letterSpacing: 2,
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={verify}
                disabled={!canVerify}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--sw-radius-sm)",
                  border: "1px solid rgba(110,231,255,0.45)",
                  background:
                    "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
                  fontWeight: 800,
                  color: "var(--sw-text)",
                  cursor: canVerify ? "pointer" : "not-allowed",
                  opacity: canVerify ? 1 : 0.6,
                }}
              >
                Enter portal
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setStatus("");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: "var(--sw-radius-sm)",
                  border: "1px solid var(--sw-border)",
                  background: "rgba(255,255,255,0.04)",
                  fontWeight: 700,
                  color: "var(--sw-text)",
                  cursor: "pointer",
                }}
              >
                Change email
              </button>
            </div>
          </>
        )}

        {status ? <div style={{ marginTop: 12, color: "var(--sw-muted)", fontSize: 13 }}>{status}</div> : null}
      </section>
    </main>
  );
}

