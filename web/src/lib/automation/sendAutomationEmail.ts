import { getResend } from "../resend";

export async function sendAutomationEmail(opts: { to: string; subject: string; text: string; html?: string | null }) {
  const resend = getResend();
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is required");

  return await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html || undefined,
  });
}
