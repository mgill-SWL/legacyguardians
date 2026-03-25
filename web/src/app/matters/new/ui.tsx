"use client";

import { FormEvent, useMemo, useState } from "react";

type Child = { name: string };

type DistributionScheme =
  | "standard-per-stirpes-ni21-row-25-30-halves"
  | "bloodline-residual";

export function NewMatterForm() {
  const [displayName, setDisplayName] = useState("");
  const [grantor1, setGrantor1] = useState("");
  const [grantor2, setGrantor2] = useState("");
  const [children, setChildren] = useState<Child[]>([]);
  const [hasMinorChildren, setHasMinorChildren] = useState(false);
  const [successor1, setSuccessor1] = useState("");
  const [successor2, setSuccessor2] = useState("");
  const [scheme, setScheme] = useState<DistributionScheme>(
    "standard-per-stirpes-ni21-row-25-30-halves"
  );

  const canSubmit = useMemo(() => {
    return grantor1.trim() && grantor2.trim() && (displayName.trim() || true);
  }, [grantor1, grantor2, displayName]);

  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "done"; matterId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: "saving" });

    const res = await fetch("/api/matters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: displayName.trim() || `${grantor1} + ${grantor2} (Joint Trust)`,
        intake: {
          grantors: [grantor1.trim(), grantor2.trim()],
          hasMinorChildren,
          children: children.map((c) => c.name.trim()).filter(Boolean),
          successorTrustees: [successor1.trim(), successor2.trim()].filter(Boolean),
          distributionScheme: scheme,
        },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      setStatus({ kind: "error", message: txt || `HTTP ${res.status}` });
      return;
    }

    const data = (await res.json()) as { matterId: string };
    setStatus({ kind: "done", matterId: data.matterId });
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 18px 64px" }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>New matter (MVP)</h1>
      <p style={{ marginTop: 10, color: "var(--sw-muted)", maxWidth: 720 }}>
        Bare-minimum intake for a joint trust. This will evolve.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: 18, display: "grid", gap: 14 }}>
        <section
          style={{
            padding: 18,
            borderRadius: "var(--sw-radius)",
            background: "var(--sw-card)",
            border: "1px solid var(--sw-border)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Matter</div>
          <label style={{ display: "grid", gap: 6, maxWidth: 520 }}>
            <span style={{ color: "var(--sw-muted)" }}>Display name (optional)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Doe + Doe (Joint Trust)"
              style={inputStyle}
            />
          </label>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Grantors</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Grantor 1</span>
              <input value={grantor1} onChange={(e) => setGrantor1(e.target.value)} style={inputStyle} required />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Grantor 2</span>
              <input value={grantor2} onChange={(e) => setGrantor2(e.target.value)} style={inputStyle} required />
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Children (optional)</div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={hasMinorChildren}
              onChange={(e) => setHasMinorChildren(e.target.checked)}
            />
            <span style={{ color: "var(--sw-muted)" }}>Has minor children (include minor-children POA/health care docs)</span>
          </label>
          <div style={{ display: "grid", gap: 10 }}>
            {children.length ? (
              children.map((c, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    value={c.name}
                    onChange={(e) =>
                      setChildren((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                    }
                    placeholder={`Child ${idx + 1} name`}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setChildren((prev) => prev.filter((_, i) => i !== idx))}
                    style={secondaryBtn}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div style={{ color: "var(--sw-muted)" }}>No children added.</div>
            )}
            <div>
              <button type="button" onClick={() => setChildren((p) => [...p, { name: "" }])} style={secondaryBtn}>
                + Add child
              </button>
            </div>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Successor trustees (optional)</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Successor 1</span>
              <input value={successor1} onChange={(e) => setSuccessor1(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ color: "var(--sw-muted)" }}>Successor 2</span>
              <input value={successor2} onChange={(e) => setSuccessor2(e.target.value)} style={inputStyle} />
            </label>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Distribution scheme</div>
          <label style={{ display: "grid", gap: 6, maxWidth: 520 }}>
            <span style={{ color: "var(--sw-muted)" }}>Scheme</span>
            <select value={scheme} onChange={(e) => setScheme(e.target.value as DistributionScheme)} style={inputStyle}>
              <option value="standard-per-stirpes-ni21-row-25-30-halves">NI @ 21 + ROW 1/2 @ 25 and 1/2 @ 30</option>
              <option value="bloodline-residual">Bloodline trust residual</option>
            </select>
          </label>
        </section>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={!canSubmit || status.kind === "saving"}
            style={{
              ...primaryBtn,
              opacity: !canSubmit || status.kind === "saving" ? 0.6 : 1,
              cursor: !canSubmit || status.kind === "saving" ? "not-allowed" : "pointer",
            }}
          >
            {status.kind === "saving" ? "Creating…" : "Create matter"}
          </button>

          {status.kind === "done" ? (
            <a href={`/matters/${status.matterId}`} style={{ ...secondaryBtn, textDecoration: "none" }}>
              Open matter →
            </a>
          ) : null}

          {status.kind === "error" ? <span style={{ color: "var(--sw-danger)" }}>{status.message}</span> : null}
        </div>
      </form>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: "var(--sw-radius)",
  background: "var(--sw-card)",
  border: "1px solid var(--sw-border)",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid var(--sw-border)",
  background: "rgba(255,255,255,0.04)",
  color: "var(--sw-text)",
  outline: "none",
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid rgba(110,231,255,0.45)",
  background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
  fontWeight: 800,
  color: "var(--sw-text)",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--sw-radius-sm)",
  border: "1px solid var(--sw-border)",
  background: "rgba(255,255,255,0.04)",
  fontWeight: 700,
  color: "var(--sw-text)",
  cursor: "pointer",
};
