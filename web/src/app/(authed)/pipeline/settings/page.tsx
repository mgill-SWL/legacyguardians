import { prisma } from "@/lib/prisma";
import { PipelineSettingsClient } from "./ui";

export const dynamic = "force-dynamic";

export default async function PipelineSettingsPage() {
  const pipelines = await prisma.pipeline.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Pipeline settings</h1>
      <p style={{ marginTop: 8, color: "var(--sw-muted, #aab4d4)" }}>
        Add/delete/reorder stages. Automations will hang off stages later.
      </p>

      <PipelineSettingsClient pipelines={pipelines} />
    </div>
  );
}
