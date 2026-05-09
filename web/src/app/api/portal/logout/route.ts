import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { portalCookieName } from "@/lib/portalSession";

export async function POST() {
  const jar = await cookies();
  jar.set(portalCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return NextResponse.json({ ok: true });
}

