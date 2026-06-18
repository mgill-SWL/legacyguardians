import { getServerSession } from "next-auth";
import type { MatterPartyRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { normalizeE164 } from "@/lib/ringcentral";
import { MATTER_PARTY_ROLE_VALUES } from "@/lib/matter/practiceArea";

export const dynamic = "force-dynamic";

type Body = {
  role?: unknown;
  contactId?: unknown;
  newContact?: {
    displayName?: unknown;
    email?: unknown;
    phone?: unknown;
    organization?: unknown;
  };
};

export async function POST(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });
  const firmId = user.activeFirmId;

  const { matterId } = await ctx.params;
  const matter = await prisma.matter.findFirst({
    where: { id: matterId, OR: [{ firmId }, { firmId: null }] },
    select: { id: true },
  });
  if (!matter) return NextResponse.json({ ok: false, error: "matter not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const role = typeof body.role === "string" && MATTER_PARTY_ROLE_VALUES.has(body.role) ? (body.role as MatterPartyRole) : null;
  if (!role) return NextResponse.json({ ok: false, error: "a valid role is required" }, { status: 400 });

  // Resolve the contact: an existing one (must belong to this firm) or a new one.
  let contactId: string | null = null;
  if (typeof body.contactId === "string" && body.contactId) {
    const existing = await prisma.contact.findFirst({
      where: { id: body.contactId, OR: [{ firmId }, { firmId: null }] },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ ok: false, error: "contact not found" }, { status: 404 });
    contactId = existing.id;
  } else {
    const displayName = String(body.newContact?.displayName ?? "").trim();
    if (!displayName) {
      return NextResponse.json({ ok: false, error: "Pick an existing contact or enter a name for a new one." }, { status: 400 });
    }
    const rawPhone = String(body.newContact?.phone ?? "").trim();
    const created = await prisma.contact.create({
      data: {
        firmId,
        displayName,
        email: String(body.newContact?.email ?? "").trim() || null,
        phone: rawPhone ? normalizeE164(rawPhone) || rawPhone : null,
        organization: String(body.newContact?.organization ?? "").trim() || null,
        categories: ["GENERAL"],
      },
      select: { id: true },
    });
    contactId = created.id;
  }

  try {
    const party = await prisma.matterContact.create({
      data: { matterId: matter.id, contactId, role },
      select: {
        id: true,
        role: true,
        contact: { select: { id: true, displayName: true, email: true, organization: true } },
      },
    });
    return NextResponse.json({ ok: true, party });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "That contact is already a party on this matter." },
        { status: 409 }
      );
    }
    throw e;
  }
}
