import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requirePortalSession, portalCanAccessMatter } from "@/lib/portalAccess";

export const dynamic = "force-dynamic";

function stripStaffNotes(data: any) {
  if (!data || typeof data !== "object") return data;
  const copy = JSON.parse(JSON.stringify(data));
  delete copy.__staffNotes;
  return copy;
}

export async function GET(_req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await requirePortalSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { matterId } = await ctx.params;
  const access = await portalCanAccessMatter({ matterId, email: session.email });
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, displayName: true, intake: { select: { data: true, updatedAt: true } } },
  });
  if (!matter?.intake?.data) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    matterId: matter.id,
    displayName: matter.displayName,
    updatedAt: matter.intake.updatedAt,
    intake: stripStaffNotes(matter.intake.data),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ matterId: string }> }) {
  const session = await requirePortalSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { matterId } = await ctx.params;
  const access = await portalCanAccessMatter({ matterId, email: session.email });
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as null | { intake?: unknown };
  const intake = body?.intake as any;
  if (!intake || typeof intake !== "object") return NextResponse.json({ error: "intake required" }, { status: 400 });

  // Never allow client to write staff notes.
  if ("__staffNotes" in intake) delete intake.__staffNotes;

  const updated = await prisma.matter.update({
    where: { id: matterId },
    data: {
      status: "INTAKE_IN_PROGRESS",
      intake: {
        upsert: {
          create: { data: intake },
          update: { data: intake },
        },
      },
    },
    select: { intake: { select: { updatedAt: true } } },
  });

  return NextResponse.json({ ok: true, updatedAt: updated.intake?.updatedAt ?? null });
}

