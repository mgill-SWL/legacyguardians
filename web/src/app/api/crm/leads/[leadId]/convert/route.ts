import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ leadId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { leadId } = await ctx.params;

  const lead = await prisma.crmLeadPipeline.findUnique({
    where: { id: leadId },
    include: { contact: true },
  });

  if (!lead) return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
  if (lead.convertedAt || lead.convertedMatterId || lead.convertedContactId) {
    return NextResponse.json({ ok: false, error: "already converted" }, { status: 409 });
  }

  const displayName = `${lead.contact.firstName} ${lead.contact.lastName}`.trim();

  // Try to find an existing Contact by email or phone.
  const existingContact = await prisma.contact.findFirst({
    where: {
      OR: [
        ...(lead.contact.email ? [{ email: lead.contact.email }] : []),
        { phone: lead.contact.phoneE164 },
      ],
    },
  });

  const contact = existingContact
    ? await prisma.contact.update({
        where: { id: existingContact.id },
        data: {
          displayName: displayName || existingContact.displayName,
          email: lead.contact.email || existingContact.email,
          phone: lead.contact.phoneE164 || existingContact.phone,
          categories: Array.from(new Set([...(existingContact.categories as any), "CLIENT"])) as any,
        },
      })
    : await prisma.contact.create({
        data: {
          displayName: displayName || lead.contact.phoneE164,
          email: lead.contact.email,
          phone: lead.contact.phoneE164,
          categories: ["CLIENT"] as any,
        },
      });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "user not found" }, { status: 401 });

  const matter = await prisma.matter.create({
    data: {
      displayName: displayName || "New matter",
      createdById: user.id,
      status: "DRAFT",
      primaryContactId: contact.id,
      primaryEmail: lead.contact.email,
      primaryPhone: lead.contact.phoneE164,
    },
    select: { id: true },
  });

  await prisma.crmLeadPipeline.update({
    where: { id: leadId },
    data: {
      raSignedAt: new Date(),
      convertedAt: new Date(),
      convertedContactId: contact.id,
      convertedMatterId: matter.id,
    },
  });

  return NextResponse.json({ ok: true, contactId: contact.id, matterId: matter.id });
}
