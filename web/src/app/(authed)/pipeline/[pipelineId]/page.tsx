import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PipelineBoardPage(props: { params: Promise<{ pipelineId: string }> }) {
  const { pipelineId } = await props.params;

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!pipeline) {
    return <div style={{ padding: 24 }}>Pipeline not found</div>;
  }

  const links = await prisma.matterPipeline.findMany({
    where: { pipelineId },
    include: {
      matter: { select: { id: true, displayName: true, status: true } },
    },
  });

  const byStage = new Map<string, typeof links>();
  for (const s of pipeline.stages) byStage.set(s.id, []);
  for (const l of links) {
    const arr = byStage.get(l.stageId);
    if (arr) arr.push(l);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{pipeline.name}</h1>
          <div style={{ marginTop: 6, color: "var(--sw-muted, #aab4d4)" }}>
            Kanban board (read-only MVP). Drag/drop next.
          </div>
        </div>
        <Link href="/pipeline/settings" style={{ color: "inherit" }}>
          Settings →
        </Link>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "minmax(260px, 320px)",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        {pipeline.stages.map((s) => (
          <div
            key={s.id}
            style={{
              border: "1px solid var(--sw-border, rgba(255,255,255,0.12))",
              borderRadius: 14,
              background: "rgba(255,255,255,0.03)",
              padding: 12,
              minHeight: 240,
            }}
          >
            <div style={{ fontWeight: 900 }}>{s.name}</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {(byStage.get(s.id) || []).map((l) => (
                <Link
                  key={l.id}
                  href={`/matters/${l.matter.id}`}
                  style={{
                    display: "block",
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.18)",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{l.matter.displayName}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--sw-muted, #aab4d4)" }}>
                    {l.matter.status}
                  </div>
                </Link>
              ))}
              {(byStage.get(s.id) || []).length === 0 ? (
                <div style={{ color: "var(--sw-muted, #aab4d4)", fontSize: 12 }}>
                  No matters in this stage.
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
