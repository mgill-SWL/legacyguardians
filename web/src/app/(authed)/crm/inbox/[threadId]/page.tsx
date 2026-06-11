import { prisma } from '@/lib/prisma';
import { Composer } from './Composer';
import { IntakeResolutionPanel } from './IntakeResolutionPanel';

export const dynamic = 'force-dynamic';

export default async function CrmThreadPage(props: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await props.params;

  const thread = await prisma.crmMessageThread.findUnique({
    where: { id: threadId },
    include: {
      contact: true,
      lead: { include: { campaign: true } },
      messages: { orderBy: { createdAt: 'asc' }, take: 200 },
    },
  });

  if (!thread) {
    return <div style={{ padding: 24 }}>Thread not found</div>;
  }

  const leadOptions = await prisma.crmLeadPipeline.findMany({
    where: {
      closed: false,
      convertedMatterId: null,
      contact: { OR: [{ firmId: thread.contact.firmId }, { firmId: null }] },
    },
    include: { campaign: true, contact: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: 40,
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>
        {thread.contact.firstName} {thread.contact.lastName} ({thread.contact.phoneE164})
      </h1>
      <IntakeResolutionPanel
        leadId={thread.leadId}
        leadOptions={leadOptions.map((lead) => ({
          id: lead.id,
          label: `${lead.contact.firstName} ${lead.contact.lastName}`.trim() || lead.contact.phoneE164,
          meta: `${lead.campaign.name} · ${lead.dateAdded.toISOString().slice(0, 10)}`,
        }))}
        matchConfidence={thread.matchConfidence}
        matchSummary={thread.matchSummary}
        needsConflictCheck={thread.needsConflictCheck}
        status={thread.intakeResolutionStatus}
        threadId={thread.id}
      />

      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        {thread.messages.map((m) => (
          <div
            key={m.id}
            style={{
              border: '1px solid #eee',
              borderRadius: 10,
              padding: 10,
              background: m.direction === 'OUTBOUND' ? '#f7fbff' : '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, color: '#666' }}>
              {m.direction} · {m.createdAt.toISOString()}
            </div>
            <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{m.body}</div>
          </div>
        ))}
      </div>

      <Composer threadId={thread.id} />
    </div>
  );
}
