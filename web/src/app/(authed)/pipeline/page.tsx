import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PipelineHome() {
  const pipelines = await prisma.pipeline.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Pipeline</h1>
        <Link href="/pipeline/settings" style={{ color: "inherit" }}>
          Settings →
        </Link>
      </div>

      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Kanban shell (MVP). Matters can belong to multiple pipelines.
      </p>

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {pipelines.map((p) => (
          <Link
            key={p.id}
            href={`/pipeline/${p.id}`}
            style={{
              border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
              borderRadius: 14,
              padding: 14,
              background: "rgba(255,255,255,0.03)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontWeight: 900 }}>{p.name}</div>
            <div style={{ marginTop: 6, color: "var(--sw-muted, #aab4d4)", fontSize: 12 }}>
              {p.stages.length} stages
            </div>
          </Link>
        ))}
        {pipelines.length === 0 ? (
          <div style={{ color: "var(--sw-muted, #aab4d4)" }}>
            No pipelines yet. Go to Settings to add one.
          </div>
        ) : null}
      </div>
    </div>
  );
}
