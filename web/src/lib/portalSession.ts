import crypto from "node:crypto";

const COOKIE_NAME = "lg_portal";

export function portalCookieName() {
  return COOKIE_NAME;
}

type PortalSession = {
  email: string;
  iat: number; // epoch seconds
  exp: number; // epoch seconds
};

function base64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function unbase64url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64");
}

function hmacSha256(secret: string, data: string) {
  return crypto.createHmac("sha256", secret).update(data).digest();
}

function secretOrThrow() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is required for portal sessions");
  return s;
}

export function signPortalSession(email: string, ttlSeconds = 60 * 60 * 24 * 30) {
  const now = Math.floor(Date.now() / 1000);
  const session: PortalSession = {
    email: email.toLowerCase().trim(),
    iat: now,
    exp: now + ttlSeconds,
  };

  const payload = base64url(Buffer.from(JSON.stringify(session), "utf8"));
  const sig = base64url(hmacSha256(secretOrThrow(), payload));
  return `${payload}.${sig}`;
}

export function verifyPortalSession(raw: string | undefined | null): PortalSession | null {
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = base64url(hmacSha256(secretOrThrow(), payload));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  const json = unbase64url(payload).toString("utf8");
  const parsed = JSON.parse(json) as PortalSession;
  const now = Math.floor(Date.now() / 1000);
  if (!parsed?.email || !parsed.exp || parsed.exp < now) return null;
  return parsed;
}

