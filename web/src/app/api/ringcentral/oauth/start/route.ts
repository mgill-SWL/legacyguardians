import { NextResponse } from 'next/server';
import { ringCentralAuthorizeUrl, randomState } from '@/lib/ringcentral';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/authOptions';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // MVP: we don't persist state yet. We'll add a CSRF/state table once flow is proven.
  const state = randomState();
  const url = ringCentralAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
