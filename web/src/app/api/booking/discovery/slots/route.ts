import { NextResponse } from "next/server";

import { getBookingSlots } from "@/lib/booking/booking";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ ok: false, error: "date required (YYYY-MM-DD)" }, { status: 400 });

  try {
    const { slots, tz } = await getBookingSlots({ typeSlug: "discovery-call", date });
    return NextResponse.json({ ok: true, date, tz, slots });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}

