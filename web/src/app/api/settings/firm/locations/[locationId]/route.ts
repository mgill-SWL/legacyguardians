import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import type { Prisma } from "@prisma/client";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Payload = { name?: string; slug?: string; active?: boolean };

export async function PATCH(request: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  // v1: only global ADMIN can edit locations.
  if (user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const json = (await request.json().catch(() => null)) as Payload | null;
  if (!json) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

  const patch: Prisma.FirmLocationUpdateInput = {};
  if (json.name !== undefined) {
    const name = String(json.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });
    patch.name = name;
  }
  if (json.slug !== undefined) {
    const slug = String(json.slug || "").trim().toUpperCase();
    if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
    if (!/^[A-Za-z0-9-]{2,20}$/.test(slug)) {
      return NextResponse.json({ ok: false, error: "slug must be 2-20 chars: letters, numbers, hyphen" }, { status: 400 });
    }
    patch.slug = slug;
  }
  if (json.active !== undefined) patch.active = !!json.active;

  const loc = await prisma.firmLocation.findUnique({ where: { id: locationId } });
  if (!loc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (loc.firmId !== user.activeFirmId) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  try {
    await prisma.firmLocation.update({ where: { id: locationId }, data: patch });
  } catch (e: unknown) {
    // Prisma unique constraint on (firmId, slug) shows up as P2002.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") {
      return NextResponse.json({ ok: false, error: "slug already exists" }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "update failed" }, { status: 500 });
  }

  // If a location was deactivated and a user is currently set to it, clear their active location.
  if (patch.active === false) {
    await prisma.firmLocationMember.deleteMany({ where: { firmLocationId: locationId } });
    await prisma.user.updateMany({ where: { activeLocationId: locationId }, data: { activeLocationId: null } });
    await prisma.user.updateMany({ where: { defaultLocationId: locationId }, data: { defaultLocationId: null } });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? null;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.activeFirmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });
  if (user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const loc = await prisma.firmLocation.findUnique({ where: { id: locationId } });
  if (!loc) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  if (loc.firmId !== user.activeFirmId) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const [matters, timeEntries, invoices] = await Promise.all([
    prisma.matter.count({ where: { primaryLocationId: locationId } }),
    prisma.timeEntry.count({ where: { locationId: locationId } }),
    prisma.invoice.count({ where: { locationId: locationId } }),
  ]);

  // If the location is referenced, we can't delete without cascading business data.
  if (matters || timeEntries || invoices) {
    await prisma.firmLocation.update({ where: { id: locationId }, data: { active: false } });
    await prisma.firmLocationMember.deleteMany({ where: { firmLocationId: locationId } });
    await prisma.user.updateMany({ where: { activeLocationId: locationId }, data: { activeLocationId: null } });
    await prisma.user.updateMany({ where: { defaultLocationId: locationId }, data: { defaultLocationId: null } });
    return NextResponse.json({ ok: true, deleted: false, deactivated: true, reason: "Location is referenced by matters/time/invoices" });
  }

  await prisma.firmLocationMember.deleteMany({ where: { firmLocationId: locationId } });
  await prisma.user.updateMany({ where: { activeLocationId: locationId }, data: { activeLocationId: null } });
  await prisma.user.updateMany({ where: { defaultLocationId: locationId }, data: { defaultLocationId: null } });
  await prisma.firmLocation.delete({ where: { id: locationId } });

  return NextResponse.json({ ok: true, deleted: true });
}
