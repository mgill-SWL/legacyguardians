import Link from 'next/link';

export default function CrmHomePage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>CRM</h1>
      <ul style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        <li>
          <Link href="/crm/queue">Queue</Link>
        </li>
      </ul>
    </div>
  );
}
