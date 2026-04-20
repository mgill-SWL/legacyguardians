import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function baseUrl() {
  return process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });

  const cookieState = (req as any).cookies?.get?.("lg.google.oauth.state")?.value;
  // Next 16 route handlers don't expose cookies on Request consistently; rely on NextResponse cookie parsing fallback.

  // We'll validate state using the header cookie manually.
  const cookieHeader = (req.headers.get("cookie") || "").split(";").map((s) => s.trim());
  const stateCookie = cookieHeader.find((c) => c.startsWith("lg.google.oauth.state="));
  const stateValue = stateCookie ? decodeURIComponent(stateCookie.split("=")[1] || "") : null;

  if (!state || !stateValue || state !== stateValue) {
    return NextResponse.json({ error: "invalid state" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "missing google oauth env" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL || baseUrl()}/api/google/oauth/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => null)) as any;
  if (!tokenRes.ok) {
    return NextResponse.json({ error: "token exchange failed", detail: tokenJson }, { status: 500 });
  }

  const accessToken = tokenJson.access_token as string;
  const refreshToken = tokenJson.refresh_token as string | undefined;
  const expiresIn = tokenJson.expires_in as number;
  const scope = tokenJson.scope as string | undefined;

  // Fetch profile email
  const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const me = (await meRes.json().catch(() => null)) as any;
  if (!meRes.ok || !me?.email) {
    return NextResponse.json({ error: "failed to fetch userinfo" }, { status: 500 });
  }

  const connectedBy = await prisma.user.findUnique({ where: { email: session.user.email } });

  // Upsert connection. Note: refreshToken may be absent if Google didn't re-issue it.
  const existing = await prisma.googleConnection.findUnique({ where: { googleEmail: me.email } });

  if (existing && !refreshToken) {
    await prisma.googleConnection.update({
      where: { id: existing.id },
      data: {
        accessToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        scope,
        connectedByUserId: connectedBy?.id,
      },
    });
  } else {
    await prisma.googleConnection.upsert({
      where: { googleEmail: me.email },
      create: {
        googleEmail: me.email,
        accessToken,
        refreshToken: refreshToken || "",
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        scope,
        connectedByUserId: connectedBy?.id,
      },
      update: {
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        scope,
        connectedByUserId: connectedBy?.id,
      },
    });
  }

  const res = NextResponse.redirect(`${process.env.NEXTAUTH_URL || baseUrl()}/settings/google`);
  res.cookies.set("lg.google.oauth.state", "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
