import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value ?? "").trim() || null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { leadId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    spouseFirstName?: unknown;
    spouseLastName?: unknown;
    spouseEmail?: unknown;
    spousePhone?: unknown;
  };

  const lead = await prisma.crmLeadPipeline.findFirst({
    where: {
      id: leadId,
      contact: { OR: [{ firmId: user.activeFirmId }, { firmId: null }] },
    },
    select: { id: true },
  });
  if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });

  const email = clean(body.spouseEmail);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Spouse email is not a valid email address." }, { status: 400 });
  }

  const updated = await prisma.crmLeadPipeline.update({
    where: { id: lead.id },
    data: {
      spouseFirstName: clean(body.spouseFirstName),
      spouseLastName: clean(body.spouseLastName),
      spouseEmail: email,
      spousePhone: clean(body.spousePhone),
    },
    select: {
      id: true,
      spouseFirstName: true,
      spouseLastName: true,
      spouseEmail: true,
      spousePhone: true,
    },
  });

  return NextResponse.json({ ok: true, lead: updated });
}
