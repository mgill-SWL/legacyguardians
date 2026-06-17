import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Deletes a webinar (its campaign + sessions). Guarded: a campaign delete
// cascades to registrations, leads, spend and tasks, so we refuse to delete
// any webinar that has registrations or leads — only empty/test ones go.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { activeFirmId: true },
  });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;

  const campaign = await prisma.crmCampaign.findUnique({ where: { id }, select: { id: true } });
  if (!campaign) return NextResponse.json({ ok: false, error: "Webinar not found." }, { status: 404 });

  const [registrations, leads, showings] = await Promise.all([
    prisma.crmRegistration.count({ where: { campaignId: id } }),
    prisma.crmLeadPipeline.count({ where: { campaignId: id } }),
    prisma.crmShowing.count({ where: { campaignId: id } }),
  ]);

  if (showings === 0) {
    return NextResponse.json(
      { ok: false, error: "This campaign has no webinar sessions; delete it from its own section." },
      { status: 400 }
    );
  }

  if (registrations > 0 || leads > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `Can't delete: this webinar has ${registrations} registration${registrations === 1 ? "" : "s"} and ${leads} lead${leads === 1 ? "" : "s"}. Webinars with activity are protected so reporting data isn't lost.`,
      },
      { status: 409 }
    );
  }

  // Empty webinar — safe to remove. Cascade clears its (empty) sessions.
  await prisma.crmCampaign.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
