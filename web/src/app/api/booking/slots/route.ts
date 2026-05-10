import { NextResponse } from "next/server";

import { getBookingSlots } from "@/lib/booking/booking";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const type = url.searchParams.get("type");
  if (!type) return NextResponse.json({ ok: false, error: "type required" }, { status: 400 });
  if (!date) return NextResponse.json({ ok: false, error: "date required (YYYY-MM-DD)" }, { status: 400 });

  try {
    const { slots, tz } = await getBookingSlots({ typeSlug: type, date });
    return NextResponse.json({ ok: true, type, date, tz, slots });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}

