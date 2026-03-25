import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ matterId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { matterId } = await params;
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: { intake: true },
  });

  if (!matter) {
    return (
      <main style={{ padding: 24 }}>
        <p>Matter not found.</p>
        <Link href="/matters">Back</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 18px 64px" }}>
      <Link href="/matters" style={{ color: "var(--sw-muted)", textDecoration: "none" }}>
        ← Matters
      </Link>
      <h1 style={{ marginTop: 14, marginBottom: 6 }}>{matter.displayName}</h1>
      <div style={{ color: "var(--sw-muted)", fontSize: 13 }}>Status: {matter.status}</div>

      <section
        style={{
          marginTop: 18,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Intake (raw JSON, v0)</div>
        <pre
          style={{
            margin: 0,
            padding: 14,
            borderRadius: "var(--sw-radius-sm)",
            border: "1px solid var(--sw-border)",
            background: "rgba(0,0,0,0.25)",
            overflowX: "auto",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {JSON.stringify(matter.intake?.data ?? null, null, 2)}
        </pre>
      </section>

      <section
        style={{
          marginTop: 14,
          padding: 18,
          borderRadius: "var(--sw-radius)",
          background: "var(--sw-card)",
          border: "1px solid var(--sw-border)",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Generate (next)</div>
        <p style={{ margin: 0, color: "var(--sw-muted)" }}>
          Next: wire <code>/api/generate</code> to produce a DOCX from the canonical joint template.
        </p>
      </section>
    </main>
  );
}
