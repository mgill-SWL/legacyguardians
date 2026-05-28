import { prisma } from "@/lib/prisma";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type GoogleFreeBusyResponse = {
  calendars?: {
    primary?: {
      busy?: { start: string; end: string }[];
    };
  };
};

type GoogleEventResponse = {
  id?: string;
  htmlLink?: string;
};

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

  const json = (await res.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!res.ok) {
    throw new Error(`Google refresh failed for ${googleEmail}`);
  }

  const accessToken = json?.access_token;
  const expiresIn = json?.expires_in;
  if (!accessToken || !expiresIn) throw new Error(`Google refresh returned an invalid token payload for ${googleEmail}`);

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

  const json = (await res.json().catch(() => null)) as GoogleFreeBusyResponse | null;
  if (!res.ok) throw new Error(`Freebusy failed for ${googleEmail}`);

  const busy = json?.calendars?.primary?.busy || [];
  return busy;
}

export async function googleCreateEvent({
  googleEmail,
  summary,
  description,
  location,
  start,
  end,
  attendeeEmails,
}: {
  googleEmail: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendeeEmails?: string[];
}) {
  const token = await getGoogleAccessToken(googleEmail);
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("sendUpdates", "all");

  const attendees = Array.from(new Set((attendeeEmails || []).map((email) => email.trim()).filter(Boolean)));

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      summary,
      description,
      location,
      start: { dateTime: start },
      end: { dateTime: end },
      attendees: attendees.length ? attendees.map((email) => ({ email })) : undefined,
    }),
  });

  const json = (await res.json().catch(() => null)) as GoogleEventResponse | null;
  if (!res.ok) throw new Error(`Create event failed for ${googleEmail}`);
  if (!json?.id) throw new Error(`Create event returned an invalid payload for ${googleEmail}`);

  return { id: json.id, htmlLink: json.htmlLink };
}
