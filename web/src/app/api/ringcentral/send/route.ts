import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/authOptions';
import { prisma } from '@/lib/prisma';
import { normalizeE164, ringCentralApi, ringCentralRefreshToken } from '@/lib/ringcentral';

export const dynamic = 'force-dynamic';

type SendBody = {
  threadId?: string;
  to?: string;
  text?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as SendBody | null;
  if (!body?.text?.trim()) {
    return NextResponse.json({ ok: false, error: 'Missing text' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { ringCentralConnection: true },
  });

  if (!user?.ringCentralConnection) {
    return NextResponse.json({ ok: false, error: 'RingCentral not connected' }, { status: 400 });
  }

  const shared = normalizeE164(process.env.RINGCENTRAL_SHARED_SMS_NUMBER);
  if (!shared) {
    return NextResponse.json({ ok: false, error: 'Server missing RINGCENTRAL_SHARED_SMS_NUMBER' }, { status: 500 });
  }

  let to = normalizeE164(body.to);
  let thread = null as null | { id: string; contactId: string; contact: { phoneE164: string } };

  if (body.threadId) {
    thread = await prisma.crmMessageThread.findUnique({
      where: { id: body.threadId },
      include: { contact: true },
    });
    if (!thread) {
      return NextResponse.json({ ok: false, error: 'Thread not found' }, { status: 404 });
    }
    to = normalizeE164(thread.contact.phoneE164);
  }

  if (!to) {
    return NextResponse.json({ ok: false, error: 'Missing to' }, { status: 400 });
  }

  // Refresh token if needed.
  const now = Date.now();
  let accessToken = user.ringCentralConnection.accessToken;
  if (user.ringCentralConnection.expiresAt.getTime() < now + 60_000) {
    const refreshed = await ringCentralRefreshToken(user.ringCentralConnection.refreshToken);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

    const updated = await prisma.ringCentralConnection.update({
      where: { userId: user.id },
      data: {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt,
        scope: refreshed.scope,
      },
    });
    accessToken = updated.accessToken;
  }

  // Send SMS (RingCentral endpoint).
  const rcResp = await ringCentralApi<any>(accessToken, '/restapi/v1.0/account/~/extension/~/sms', {
    method: 'POST',
    body: JSON.stringify({
      from: { phoneNumber: shared },
      to: [{ phoneNumber: to }],
      text: body.text.trim(),
    }),
  });

  // Persist outbound message in CRM.
  const contact = await prisma.crmContact.upsert({
    where: { phoneE164: to },
    update: {},
    create: {
      firstName: 'Unknown',
      lastName: 'Lead',
      phoneE164: to,
      state: 'UNKNOWN',
    },
  });

  const t =
    thread ||
    (await prisma.crmMessageThread.create({
      data: {
        contactId: contact.id,
        provider: 'RINGCENTRAL',
        lastMessageAt: new Date(),
      },
    }));

  const createdAt = new Date();

  await prisma.crmMessage.create({
    data: {
      threadId: t.id,
      direction: 'OUTBOUND',
      fromNumberE164: shared,
      toNumberE164: to,
      body: body.text.trim(),
      providerMessageId: rcResp?.id ? `rc-sent:${rcResp.id}` : null,
      status: 'SENT',
      sentAt: createdAt,
    },
  });

  await prisma.crmMessageThread.update({
    where: { id: t.id },
    data: { lastMessageAt: createdAt },
  });

  return NextResponse.json({ ok: true });
}
