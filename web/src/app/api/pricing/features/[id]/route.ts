import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = {
  moneyCents?: number;
  textValue?: string | null;
  boolValue?: boolean;
  numberValue?: number;
  active?: boolean;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const firmId = user.activeFirmId;
  if (!firmId) return NextResponse.json({ ok: false, error: "no active firm" }, { status: 400 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ ok: false, error: "body required" }, { status: 400 });

  const r = await prisma.feeFeature.updateMany({
    where: { id, firmId },
    data: {
      moneyCents: body.moneyCents === undefined ? undefined : body.moneyCents,
      textValue: body.textValue === undefined ? undefined : body.textValue,
      boolValue: body.boolValue === undefined ? undefined : body.boolValue,
      numberValue: body.numberValue === undefined ? undefined : body.numberValue,
      active: body.active === undefined ? undefined : body.active,
    },
  });

  if (r.count !== 1) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
