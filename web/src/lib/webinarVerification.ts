import crypto from "crypto";

export function generate6DigitCode() {
  // 000000-999999
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

export function generateWatchToken() {
  return crypto.randomBytes(18).toString("base64url");
}

export function hashCode(code: string) {
  const salt = process.env.WEBINAR_CODE_SALT || "dev-salt";
  return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
}
