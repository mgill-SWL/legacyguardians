import { prisma } from "@/lib/prisma";

export async function getGoogleAccessToken(googleEmail: string) {
  const conn = await prisma.googleConnection.findUnique({ where: { googleEmail } });
  if (!conn) throw new Error(`No Google connection for ${googleEmail}`);

  // If token still valid for 60s, use it.
  if (conn.expiresAt.getTime() - Date.now() > 60_000) return conn.accessToken;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing Google OAuth env vars");

  const refreshToken = conn.refreshToken;
  if (!refreshToken) throw new Error(`Missing refresh token for ${googleEmail} (reconnect Google)`);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    throw new Error(`Google refresh failed for ${googleEmail}`);
  }

  const accessToken = json.access_token as string;
  const expiresIn = json.expires_in as number;

  await prisma.googleConnection.update({
    where: { googleEmail },
    data: {
      accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    },
  });

  return accessToken;
}

export async function googleFreeBusy({
  googleEmail,
  timeMin,
  timeMax,
}: {
  googleEmail: string;
  timeMin: string;
  timeMax: string;
}) {
  const token = await getGoogleAccessToken(googleEmail);
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(`Freebusy failed for ${googleEmail}`);

  const busy = json?.calendars?.primary?.busy || [];
  return busy as { start: string; end: string }[];
}

export async function googleCreateEvent({
  googleEmail,
  summary,
  description,
  start,
  end,
  attendeeEmail,
}: {
  googleEmail: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  attendeeEmail?: string;
}) {
  const token = await getGoogleAccessToken(googleEmail);

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees: attendeeEmail ? [{ email: attendeeEmail }] : undefined,
    }),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) throw new Error(`Create event failed for ${googleEmail}`);

  return { id: json.id as string, htmlLink: json.htmlLink as string | undefined };
}
