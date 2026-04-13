import { NextResponse } from 'next/server';

// TODO: RingCentral webhook verification/signature validation.
// MVP: accept payload and log. We'll wire actual message ingestion once we confirm event shape.
export async function POST(req: Request) {
  const bodyText = await req.text();

  // Intentionally do not parse/assume structure yet.
  console.log('[ringcentral:webhook] raw:', bodyText.slice(0, 2000));

  return NextResponse.json({ ok: true });
}
