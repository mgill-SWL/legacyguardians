import Link from "next/link";

function Card({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: 18,
        borderRadius: "var(--sw-radius)",
        background: "var(--sw-card)",
        border: "1px solid var(--sw-border)",
        boxShadow: "var(--sw-shadow)",
        textDecoration: "none",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 6, color: "var(--sw-muted)", lineHeight: 1.35 }}>{desc}</div>
      <div
        style={{
          marginTop: 14,
          display: "inline-flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 10px",
          borderRadius: "var(--sw-radius-sm)",
          border: "1px solid var(--sw-border)",
          background: "rgba(255,255,255,0.04)",
          fontWeight: 600,
        }}
      >
        {cta} <span aria-hidden>→</span>
      </div>
    </Link>
  );
}

export default function DashboardLanding() {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "44px 18px 64px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "baseline" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, letterSpacing: -0.5 }}>Legacy Guardians</h1>
          <p style={{ marginTop: 10, marginBottom: 0, color: "var(--sw-muted)", maxWidth: 760 }}>
            Internal drafting dashboard (MVP). Next up: joint trust intake → DOCX generation.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/login"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid var(--sw-border)",
              background: "rgba(255,255,255,0.04)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Staff sign-in
          </Link>
          <Link
            href="/dashboard"
            style={{
              padding: "10px 12px",
              borderRadius: "var(--sw-radius-sm)",
              border: "1px solid rgba(110,231,255,0.45)",
              background: "linear-gradient(135deg, rgba(110,231,255,0.14), rgba(167,139,250,0.10))",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Open dashboard
          </Link>
        </div>
      </header>

      <section
        style={{
          marginTop: 26,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <Card
          title="Matters"
          desc="Create and manage matters (MVP scaffold)."
          href="/matters"
          cta="Go to matters"
        />
        <Card
          title="New joint trust (coming)"
          desc="Bare-minimum intake → generate DOCX from canonical joint template."
          href="/matters"
          cta="Start (soon)"
        />
        <Card
          title="System"
          desc="Auth is currently restricted to @speedwelllaw.com."
          href="/login"
          cta="Sign in"
        />
      </section>

      <footer style={{ marginTop: 28, color: "var(--sw-muted)", fontSize: 12 }}>
        Speedwell-style tokens are in <code>src/design/tokens.css</code>. We can refine the palette/typography to match the
        existing brand.
      </footer>
    </main>
  );
}
