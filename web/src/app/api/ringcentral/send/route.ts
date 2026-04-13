import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // MVP stub.
  // Later: validate session/user, lookup contact/thread, send via RingCentral API, persist message.
  const json = await req.json().catch(() => null);
  return NextResponse.json({ ok: true, received: json });
}
