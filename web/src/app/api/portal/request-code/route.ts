import { NextResponse } from "next/server";

import { getResend } from "@/lib/resend";
import { prisma } from "@/lib/prisma";

import crypto from "node:crypto";

function baseUrl() {
  return process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

function hashCode({ email, code }: { email: string; code: string }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return crypto
    .createHash("sha256")
    .update(`portal:${email.toLowerCase().trim()}:${code}:${secret}`)
    .digest("hex");
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as null | { email?: string };
  const email = (body?.email || "").toLowerCase().trim();

  // Always return ok to avoid account enumeration.
  if (!email || !email.includes("@")) return NextResponse.json({ ok: true });

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is required");

  const resend = getResend();

  // 6-digit code
  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const token = hashCode({ email, code });
  const identifier = `portal:${email}`;
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  // Best-effort cleanup of previous portal tokens for this email.
  await prisma.verificationToken.deleteMany({ where: { identifier } });

  await prisma.verificationToken.create({
    data: {
      identifier,
      token,
      expires,
    },
  });

  await resend.emails.send({
    from,
    to: email,
    subject: "Your Legacy Guardians access code",
    text: `Your Legacy Guardians access code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `<div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.4">
      <div style="margin-bottom:14px">
        <img alt="Legacy Guardians" src="${baseUrl()}/brand/legacy-guardians-brand-kit/png-lockup/lockup-light-600.png" style="height:44px; width:auto; display:block" />
      </div>
      <p>Your Legacy Guardians access code is:</p>
      <p style="font-size:20px; font-weight:800; letter-spacing:2px; margin: 10px 0">${code}</p>
      <p style="color:#666">This code expires in 10 minutes.</p>
    </div>`,
  });

  return NextResponse.json({ ok: true });
}
