import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { normalizeE164 } from "@/lib/ringcentral";

export const dynamic = "force-dynamic";

type Body = {
  displayName: string;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
  categories?: ("CLIENT" | "VENDOR" | "REFERRER" | "PROFESSIONAL_ADVISOR" | "GENERAL")[];
  professionalType?: "FINANCIAL_ADVISOR" | "CPA" | "INSURANCE" | "BANKER" | "REALTOR" | "CARE_MANAGER" | "ATTORNEY" | "OTHER" | null;
  referralSourceStatus?: "PROSPECT" | "ACTIVE" | "INACTIVE" | null;
  relationshipOwnerId?: string | null;
  notes?: string | null;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, activeFirmId: true } });
  if (!user?.activeFirmId) return NextResponse.json({ error: "no active firm" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.displayName?.trim()) return NextResponse.json({ error: "displayName required" }, { status: 400 });
  const phone = normalizeE164(body.phone) || body.phone || null;

  const c = await prisma.contact.create({
    data: {
      firmId: user.activeFirmId,
      displayName: body.displayName.trim(),
      email: body.email || null,
      phone,
      organization: body.organization || null,
      categories: (body.categories || ["CLIENT"]) as any,
      professionalType: body.professionalType || null,
      referralSourceStatus: body.referralSourceStatus || null,
      relationshipOwnerId: body.relationshipOwnerId || null,
      notes: body.notes || null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: c.id });
}
