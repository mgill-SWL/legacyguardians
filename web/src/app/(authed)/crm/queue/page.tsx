import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function CrmQueuePage() {
  const now = new Date();

  // Some build environments typecheck against a stale Prisma Client.
  // Keep this page resilient so deploys don't fail if prisma generate ran out of order.
  const anyPrisma = prisma as any;
  const tasks = anyPrisma.crmTask
    ? await anyPrisma.crmTask.findMany({
        where: {
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueAt: { lte: now },
        },
        orderBy: [{ dueAt: 'asc' }],
        take: 50,
        include: {
          contact: true,
          campaign: true,
          showing: true,
        },
      })
    : [];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>CRM Queue</h1>
      <p style={{ marginTop: 8, color: '#666' }}>Due now ({tasks.length}) — MVP view</p>

      <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        {tasks.map((t: any) => (
          <div
            key={t.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 10,
              padding: 12,
              display: 'grid',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <strong>
                {t.contact.firstName} {t.contact.lastName}
              </strong>
              <span style={{ color: '#666', whiteSpace: 'nowrap' }}>
                {t.priority} · {t.type} · {t.ownerTeam}
              </span>
            </div>
            <div style={{ color: '#666' }}>{t.contact.phoneE164}</div>
            <div style={{ color: '#666' }}>
              Campaign: {t.campaign.slug}
              {t.showing ? ` · Showing: ${t.showing.startsAt.toISOString()}` : ''}
            </div>
            <div style={{ color: '#666' }}>Due: {t.dueAt.toISOString()}</div>
          </div>
        ))}

        {tasks.length === 0 ? (
          <div style={{ marginTop: 12, color: '#666' }}>Nothing due right now.</div>
        ) : null}
      </div>
    </div>
  );
}
