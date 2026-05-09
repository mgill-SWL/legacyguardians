import { Resend } from "resend";

let cached: Resend | null = null;

/**
 * Lazily constructs a Resend client.
 *
 * Important: constructing `new Resend(undefined)` throws immediately, which can break builds
 * (e.g., when preview env vars aren't set). So we only construct when actually sending.
 */
export function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is required");
  cached = new Resend(key);
  return cached;
}

