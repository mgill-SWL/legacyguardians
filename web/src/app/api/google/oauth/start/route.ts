import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";

export const dynamic = "force-dynamic";

function baseUrl() {
  return process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "missing GOOGLE_OAUTH_CLIENT_ID" }, { status: 500 });

  const redirectUri = `${process.env.NEXTAUTH_URL || baseUrl()}/api/google/oauth/callback`;

  const scope = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.freebusy",

    // Data imports / reporting
    "https://www.googleapis.com/auth/spreadsheets.readonly",

    // Marketing reporting (Google Ads API)
    "https://www.googleapis.com/auth/adwords",
  ].join(" ");

  const state = crypto.randomUUID();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("lg.google.oauth.state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 10 * 60 });
  return res;
}
