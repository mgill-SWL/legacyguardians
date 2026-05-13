import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

type Payload = { name?: string; slug?: string };

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ error: "No active firm" }, { status: 400 });

  // v1: only global ADMIN can create locations.
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const json = (await request.json().catch(() => null)) as Payload | null;
  const name = (json?.name || "").trim();
  const slug = (json?.slug || "").trim();
  if (!name || !slug) return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  if (!/^[A-Za-z0-9-]{2,20}$/.test(slug)) {
    return NextResponse.json({ error: "slug must be 2-20 chars: letters, numbers, hyphen" }, { status: 400 });
  }

  const created = await prisma.firmLocation.create({
    data: {
      firmId: user.activeFirmId,
      name,
      slug: slug.toUpperCase(),
      active: true,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
