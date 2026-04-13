"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await signIn("email", {
      email,
      callbackUrl: "/matters",
      redirect: false,
    });

    if (res?.error) {
      setError(res.error);
      return;
    }

    setSent(true);
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Legacy Guardians</h1>
      <p style={{ marginTop: 8 }}>Staff sign-in (speedwelllaw.com)</p>

      {sent ? (
        <p style={{ marginTop: 16 }}>
          If that email is valid, we sent you a sign-in link.
        </p>
      ) : (
        <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 8, maxWidth: 360 }}>
          <label style={{ display: "grid", gap: 4 }}>
            <span>Email</span>
            <input
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@speedwelllaw.com"
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6 }}
            />
          </label>
          <button
            type="submit"
            style={{
              padding: 10,
              borderRadius: 6,
              border: "1px solid #111",
              background: "#111",
              color: "white",
              cursor: "pointer",
            }}
          >
            Email me a sign-in link
          </button>
          {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
        </form>
      )}

      <p style={{ marginTop: 16, fontSize: 12, color: "#666" }}>
        If you don’t receive an email, check spam/junk. Magic links expire.
      </p>
    </main>
  );
}
