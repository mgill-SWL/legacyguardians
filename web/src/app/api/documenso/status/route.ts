import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { getDocumensoConnectionStatus } from "@/lib/documenso/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const status = await getDocumensoConnectionStatus();
  return NextResponse.json(status);
}
