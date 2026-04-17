import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  categories?: ("CLIENT" | "VENDOR" | "REFERRER")[];
  notes?: string | null;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.displayName?.trim()) return NextResponse.json({ error: "displayName required" }, { status: 400 });

  const c = await prisma.contact.create({
    data: {
      displayName: body.displayName.trim(),
      email: body.email || null,
      phone: body.phone || null,
      organization: body.organization || null,
      categories: (body.categories || ["CLIENT"]) as any,
      notes: body.notes || null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: c.id });
}
