import { NextResponse } from 'next/server';
import { ringCentralExchangeCode } from '@/lib/ringcentral';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/authOptions';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const token = await ringCentralExchangeCode(code);
  const expiresAt = new Date(Date.now() + token.expires_in * 1000);

  await prisma.ringCentralConnection.upsert({
    where: { userId: user.id },
    update: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
    },
    create: {
      userId: user.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt,
      scope: token.scope,
    },
  });

  return NextResponse.redirect(new URL('/settings/ringcentral?connected=1', url.origin));
}
