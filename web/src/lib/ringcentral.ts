import crypto from 'crypto';

export type RingCentralTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export function getRingCentralConfig() {
  const clientId = process.env.RINGCENTRAL_CLIENT_ID;
  const clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET;
  const redirectUri = process.env.RINGCENTRAL_REDIRECT_URI;
  const serverUrl = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing RingCentral env (RINGCENTRAL_CLIENT_ID/SECRET/REDIRECT_URI)');
  }

  return { clientId, clientSecret, redirectUri, serverUrl };
}

export function ringCentralAuthorizeUrl(state: string) {
  const { clientId, redirectUri, serverUrl } = getRingCentralConfig();
  const url = new URL('/restapi/oauth/authorize', serverUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

export function randomState() {
  return crypto.randomBytes(16).toString('hex');
}

export async function ringCentralExchangeCode(code: string): Promise<RingCentralTokenResponse> {
  const { clientId, clientSecret, redirectUri, serverUrl } = getRingCentralConfig();

  const url = new URL('/restapi/oauth/token', serverUrl);
  const form = new URLSearchParams();
  form.set('grant_type', 'authorization_code');
  form.set('code', code);
  form.set('redirect_uri', redirectUri);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RingCentral token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as RingCentralTokenResponse;
}

export async function ringCentralRefreshToken(refreshToken: string): Promise<RingCentralTokenResponse> {
  const { clientId, clientSecret, redirectUri, serverUrl } = getRingCentralConfig();

  const url = new URL('/restapi/oauth/token', serverUrl);
  const form = new URLSearchParams();
  form.set('grant_type', 'refresh_token');
  form.set('refresh_token', refreshToken);
  form.set('redirect_uri', redirectUri);

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RingCentral token refresh failed: ${res.status} ${text}`);
  }

  return (await res.json()) as RingCentralTokenResponse;
}

export async function ringCentralApi<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const { serverUrl } = getRingCentralConfig();
  const url = new URL(path, serverUrl);

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RingCentral API failed ${res.status} ${path}: ${text}`);
  }

  return (await res.json()) as T;
}

export function normalizeE164(input?: string | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (input.startsWith('+')) return input;
  return `+${digits}`;
}
