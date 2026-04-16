import { prisma } from "@/lib/prisma";
import { PipelineBoard } from "./Board";

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
      matter: {
        select: {
          id: true,
          displayName: true,
          status: true,
          primaryEmail: true,
          primaryPhone: true,
          estimatedValueCents: true,
        },
      },
    },
    orderBy: [{ sortKey: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <PipelineBoard
      pipelineId={pipeline.id}
      pipelineName={pipeline.name}
      stages={pipeline.stages.map((s) => ({ id: s.id, name: s.name, colorHex: s.colorHex }))}
      links={links.map((l) => ({
        id: l.id,
        stageId: l.stageId,
        matter: {
          id: l.matter.id,
          displayName: l.matter.displayName,
          status: l.matter.status,
          primaryEmail: l.matter.primaryEmail,
          primaryPhone: l.matter.primaryPhone,
          estimatedValueCents: l.matter.estimatedValueCents,
        },
      }))}
    />
  );
}
