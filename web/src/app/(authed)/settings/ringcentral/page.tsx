import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/authOptions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function RingCentralSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return <div style={{ padding: 24 }}>Unauthorized</div>;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { ringCentralConnection: true },
  });

  if (!user) {
    return <div style={{ padding: 24 }}>User not found</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>RingCentral</h1>

      <div style={{ marginTop: 12 }}>
        Status:{' '}
        {user.ringCentralConnection ? (
          <strong style={{ color: 'green' }}>Connected</strong>
        ) : (
          <strong style={{ color: 'crimson' }}>Not connected</strong>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Link
          href="/api/ringcentral/oauth/start"
          style={{
            display: 'inline-block',
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #ddd',
          }}
        >
          {user.ringCentralConnection ? 'Reconnect RingCentral' : 'Connect RingCentral'}
        </Link>
      </div>

      <p style={{ marginTop: 16, color: '#666', maxWidth: 700 }}>
        Each staff member connects their own RingCentral account. We’ll use a dedicated texting number as a shared inbox.
      </p>
    </div>
  );
}
