import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function contains(query: string) {
  return { contains: query, mode: "insensitive" as const };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  const [leads, contacts, matters] = await Promise.all([
    prisma.crmLeadPipeline.findMany({
      where: {
        AND: [
          { contact: { OR: [{ firmId: user.activeFirmId }, { firmId: null }] } },
        ],
        OR: [
          { contact: { firstName: contains(q) } },
          { contact: { lastName: contains(q) } },
          { contact: { email: contains(q) } },
          { contact: { phoneE164: contains(q) } },
          { campaign: { name: contains(q) } },
          { campaign: { slug: contains(q) } },
        ],
      },
      include: { contact: true, campaign: true },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
    }),
    prisma.contact.findMany({
      where: {
        firmId: user.activeFirmId,
        OR: [
          { displayName: contains(q) },
          { email: contains(q) },
          { phone: contains(q) },
          { organization: contains(q) },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
    }),
    prisma.matter.findMany({
      where: {
        firmId: user.activeFirmId,
        OR: [
          { displayName: contains(q) },
          { primaryEmail: contains(q) },
          { primaryPhone: contains(q) },
        ],
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 6,
    }),
  ]);

  const results = [
    ...leads.map((lead) => ({
      href: `/crm/leads/${lead.id}`,
      id: lead.id,
      label: `${lead.contact.firstName} ${lead.contact.lastName}`.trim() || lead.contact.phoneE164,
      meta: `${lead.campaign.name} lead`,
      type: "Lead",
    })),
    ...contacts.map((contact) => ({
      href: `/clients/contacts?selected=${contact.id}`,
      id: contact.id,
      label: contact.displayName,
      meta: contact.email || contact.phone || contact.organization || "Contact",
      type: "Contact",
    })),
    ...matters.map((matter) => ({
      href: `/matters/${matter.id}`,
      id: matter.id,
      label: matter.displayName,
      meta: matter.status.replaceAll("_", " "),
      type: "Matter",
    })),
  ].slice(0, 12);

  return NextResponse.json({ ok: true, results });
}
