import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeE164 } from '@/lib/ringcentral';

export const dynamic = 'force-dynamic';

type RcInstantMessageEvent = {
  event?: string;
  subscriptionId?: string;
  ownerId?: string;
  timestamp?: string;
  body?: {
    id?: string;
    from?: { phoneNumber?: string };
    to?: Array<{ phoneNumber?: string }>;
    subject?: string;
    direction?: string;
    creationTime?: string;
    attachments?: Array<{ id?: string; contentType?: string; uri?: string }>;
  };
};

export async function POST(req: Request) {
  // RingCentral sends a Validation-Token header during subscription validation.
  // We must echo it back within 3 seconds.
  const validationToken = req.headers.get('validation-token');

  const raw = await req.text();

  // Always keep response tiny (<1024 bytes).
  const res = NextResponse.json({ ok: true });
  if (validationToken) res.headers.set('Validation-Token', validationToken);

  let payload: RcInstantMessageEvent | null = null;
  try {
    payload = raw ? (JSON.parse(raw) as RcInstantMessageEvent) : null;
  } catch {
    return res;
  }

  if (!payload?.body) return res;

  const from = normalizeE164(payload.body.from?.phoneNumber);
  const to = normalizeE164(payload.body.to?.[0]?.phoneNumber);

  // Only ingest messages for the dedicated shared texting number (Noah).
  const shared = normalizeE164(process.env.RINGCENTRAL_SHARED_SMS_NUMBER);
  if (shared && from !== shared && to !== shared) {
    return res;
  }

  const direction = (payload.body.direction || '').toLowerCase();
  const isInbound = direction === 'inbound';

  const contactPhone = isInbound ? from : to;
  if (!contactPhone) return res;

  const contact = await prisma.crmContact.upsert({
    where: { phoneE164: contactPhone },
    update: {},
    create: {
      firstName: 'Unknown',
      lastName: 'Lead',
      phoneE164: contactPhone,
      state: 'UNKNOWN',
    },
  });

  const thread = await prisma.crmMessageThread.findFirst({
    where: { contactId: contact.id, provider: 'RINGCENTRAL' },
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

  const createdAt = payload.body.creationTime ? new Date(payload.body.creationTime) : new Date();
  const body = payload.body.subject || '';

  // Provider message id: use RC message-store id if present.
  const providerMessageId = payload.body.id ? `rc:${payload.body.id}` : null;

  await prisma.crmMessage.create({
    data: {
      threadId: t.id,
      direction: isInbound ? 'INBOUND' : 'OUTBOUND',
      fromNumberE164: from || '',
      toNumberE164: to || '',
      body,
      providerMessageId,
      status: isInbound ? 'RECEIVED' : 'SENT',
      receivedAt: isInbound ? createdAt : null,
      sentAt: isInbound ? null : createdAt,
    },
  });

  await prisma.crmMessageThread.update({
    where: { id: t.id },
    data: { lastMessageAt: createdAt },
  });

  return res;
}
