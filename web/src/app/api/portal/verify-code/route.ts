import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { portalCookieName, signPortalSession } from "@/lib/portalSession";

function hashCode({ email, code }: { email: string; code: string }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return crypto
    .createHash("sha256")
    .update(`portal:${email.toLowerCase().trim()}:${code}:${secret}`)
    .digest("hex");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { email?: string; code?: string };
  const email = (body?.email || "").toLowerCase().trim();
  const code = String(body?.code || "").trim();
  if (!email || !email.includes("@")) return NextResponse.json({ ok: false }, { status: 400 });
  if (!/^[0-9]{6}$/.test(code)) return NextResponse.json({ ok: false }, { status: 400 });

  const identifier = `portal:${email}`;
  const token = hashCode({ email, code });

  const match = await prisma.verificationToken.findFirst({
    where: { identifier, token, expires: { gt: new Date() } },
    select: { identifier: true, token: true },
  });

  if (!match) return NextResponse.json({ ok: false }, { status: 401 });

  // One-time use
  await prisma.verificationToken.delete({ where: { token: match.token } }).catch(() => {});

  const session = signPortalSession(email);
  const jar = await cookies();
  jar.set(portalCookieName(), session, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}

