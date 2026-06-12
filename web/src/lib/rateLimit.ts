import { prisma } from "@/lib/prisma";

export type RateLimitRule = {
  /** Identifies what is being limited, e.g. "public-book:phone:5551234567". */
  key: string;
  limit: number;
  windowMs: number;
};

/**
 * DB-backed fixed-window rate limiter for public endpoints. Returns true when
 * the request is allowed (and records the hit), false when the limit is hit.
 *
 * Fails OPEN on database errors so a transient DB issue cannot take down
 * legitimate public booking/registration traffic.
 */
export async function consumeRateLimit(rules: RateLimitRule[]): Promise<boolean> {
  try {
    for (const rule of rules) {
      const since = new Date(Date.now() - rule.windowMs);
      const count = await prisma.rateLimitHit.count({
        where: { key: rule.key, createdAt: { gte: since } },
      });
      if (count >= rule.limit) return false;
    }

    await prisma.rateLimitHit.createMany({ data: rules.map((rule) => ({ key: rule.key })) });

    // Opportunistic cleanup so the table stays small without a dedicated job.
    const oldest = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.rateLimitHit.deleteMany({
      where: { key: { in: rules.map((r) => r.key) }, createdAt: { lt: oldest } },
    });

    return true;
  } catch {
    return true;
  }
}

/** Best-effort client IP for rate-limit keys (Vercel sets x-forwarded-for). */
export function clientIpFrom(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const first = fwd.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

/** Normalized digits-only phone for rate-limit keys. */
export function phoneKey(raw: string): string {
  return raw.replace(/\D/g, "") || "unknown";
}

const HOUR_MS = 60 * 60 * 1000;

/** Standard rule set for a public endpoint: per-contact, per-IP, and global caps. */
export function publicEndpointRules(endpoint: string, opts: { contactKey: string; ip: string; perContactPerHour?: number; perIpPerHour?: number; globalPerHour?: number }): RateLimitRule[] {
  return [
    { key: `${endpoint}:contact:${opts.contactKey}`, limit: opts.perContactPerHour ?? 3, windowMs: HOUR_MS },
    { key: `${endpoint}:ip:${opts.ip}`, limit: opts.perIpPerHour ?? 10, windowMs: HOUR_MS },
    { key: `${endpoint}:global`, limit: opts.globalPerHour ?? 50, windowMs: HOUR_MS },
  ];
}
