import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { syncIntakeReportingFromSheet } from "@/lib/kpis/syncIntakeReporting";

export const dynamic = "force-dynamic";

function authOk(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authOk(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const spreadsheetId = process.env.LG_INTAKE_KPI_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: "LG_INTAKE_KPI_SPREADSHEET_ID missing" }, { status: 400 });
  }

  // Use the most-recently updated Google connection (sheet access token lives there).
  const gc = await prisma.googleConnection.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!gc?.googleEmail) {
    return NextResponse.json({ ok: false, error: "No Google account connected" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const sheetNameTemplate = process.env.LG_INTAKE_KPI_SHEETNAME_TEMPLATE || "{YYYY} Intake KPIs";

  try {
    const out = await syncIntakeReportingFromSheet({
      googleEmail: gc.googleEmail,
      spreadsheetId,
      year,
      sheetNameTemplate,
    });
    return NextResponse.json({ ok: true, googleEmail: gc.googleEmail, year, ...out });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}

