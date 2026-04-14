import { NextResponse } from 'next/server';
import { ringCentralApi, ringCentralExchangeCode } from '@/lib/ringcentral';
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

  // Create (or renew) a webhook subscription for inbound SMS for this extension.
  // This is best-effort; if it fails, the connection still stands.
  try {
    const webhookUrl = new URL('/api/ringcentral/webhook', url.origin).toString();
    const validationToken = process.env.RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN || 'lg-webhook';

    await ringCentralApi(token.access_token, '/restapi/v1.0/subscription', {
      method: 'POST',
      body: JSON.stringify({
        eventFilters: ['/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS'],
        deliveryMode: {
          transportType: 'WebHook',
          address: webhookUrl,
          validationToken,
        },
        expiresIn: 60 * 60 * 24 * 7, // 7 days
      }),
    });
  } catch (e) {
    console.error('RingCentral subscription create failed', e);
  }

  return NextResponse.redirect(new URL('/settings/ringcentral?connected=1', url.origin));
}
