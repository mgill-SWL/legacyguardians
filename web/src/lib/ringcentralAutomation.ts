import { prisma } from "@/lib/prisma";
import { normalizeE164, ringCentralApi, ringCentralRefreshToken } from "@/lib/ringcentral";

export async function sendAutomationSms(toRaw: string, text: string) {
  const automationEmail = process.env.RINGCENTRAL_AUTOMATION_SENDER_EMAIL;
  if (!automationEmail) throw new Error("Missing RINGCENTRAL_AUTOMATION_SENDER_EMAIL");

  const to = normalizeE164(toRaw);
  if (!to) throw new Error("Invalid to phone");

  const from = normalizeE164(process.env.RINGCENTRAL_SHARED_SMS_NUMBER);
  if (!from) throw new Error("Missing RINGCENTRAL_SHARED_SMS_NUMBER");

  const user = await prisma.user.findUnique({
    where: { email: automationEmail },
    include: { ringCentralConnection: true },
  });

  if (!user?.ringCentralConnection) {
    throw new Error(`Automation sender not connected to RingCentral: ${automationEmail}`);
  }

  // refresh if needed
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

  // Send SMS
  return await ringCentralApi<any>(accessToken, "/restapi/v1.0/account/~/extension/~/sms", {
    method: "POST",
    body: JSON.stringify({
      from: { phoneNumber: from },
      to: [{ phoneNumber: to }],
      text,
    }),
  });
}
