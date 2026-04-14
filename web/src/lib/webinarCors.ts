import { NextResponse } from "next/server";

const DEFAULT_ALLOWED = ["https://speedwelllaw.com", "https://www.speedwelllaw.com"];

export function withCors(res: NextResponse, origin: string | null) {
  const allowed = (process.env.WEBINAR_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allowList = allowed.length ? allowed : DEFAULT_ALLOWED;

  if (origin && allowList.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
  }

  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Max-Age", "86400");

  return res;
}

export function corsOptionsResponse(origin: string | null) {
  const res = NextResponse.json({ ok: true });
  return withCors(res, origin);
}
