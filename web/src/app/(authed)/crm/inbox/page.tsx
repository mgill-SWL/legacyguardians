import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function CrmInboxPage() {
  const threads = await prisma.crmMessageThread.findMany({
    where: { provider: 'RINGCENTRAL' },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: 50,
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>CRM Inbox (MVP)</h1>
      <p style={{ marginTop: 8, color: '#666' }}>RingCentral threads ({threads.length}).</p>

      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {threads.map((t) => {
          const last = t.messages[0];
          return (
            <Link
              key={t.id}
              href={`/crm/inbox/${t.id}`}
              style={{
                border: '1px solid #ddd',
                borderRadius: 10,
                padding: 12,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>
                  {t.contact.firstName} {t.contact.lastName}
                </strong>
                <span style={{ color: '#666' }}>{t.contact.phoneE164}</span>
              </div>
              <div style={{ marginTop: 6, color: '#666' }}>
                {last ? `${last.direction}: ${last.body.slice(0, 100)}` : 'No messages yet'}
              </div>
            </Link>
          );
        })}

        {threads.length === 0 ? <div style={{ color: '#666' }}>No threads yet.</div> : null}
      </div>
    </div>
  );
}
