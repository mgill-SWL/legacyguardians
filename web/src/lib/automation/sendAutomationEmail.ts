import { getResend } from "../resend";
import { prisma } from "../prisma";

type AutomationEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  firmId?: string | null;
  from?: string | null;
  replyTo?: string | null;
};

function cleanHeaderValue(value: string) {
  return value.replace(/[\r\n<>]/g, "").trim();
}

function formatFromAddress({ name, address }: { name?: string | null; address: string }) {
  const fromAddress = address.trim();
  const fromName = cleanHeaderValue(name || "");
  return fromName ? `${fromName} <${fromAddress}>` : fromAddress;
}

async function getFirmEmailIdentity(firmId?: string | null) {
  if (!firmId) return null;

  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    select: {
      emailFromName: true,
      emailFromAddress: true,
      emailReplyToAddress: true,
    },
  });

  if (!firm) return null;
  const address = firm?.emailFromAddress?.trim();
  if (!address) return null;

  return {
    from: formatFromAddress({ name: firm.emailFromName, address }),
    replyTo: firm.emailReplyToAddress?.trim() || null,
  };
}

export async function sendAutomationEmail(opts: AutomationEmailOptions) {
  const resend = getResend();
  const firmIdentity = opts.from ? null : await getFirmEmailIdentity(opts.firmId);
  const from = opts.from || firmIdentity?.from || process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is required");

  return await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html || undefined,
    replyTo: opts.replyTo || firmIdentity?.replyTo || undefined,
  });
}
