import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { getDefaultGoogleEmailForUser } from "@/lib/kpis/intakeSheet";
import { L10_REPORT_COLUMNS, L10_REPORT_SLUG } from "@/lib/kpis/reportTables";
import { syncReportTableFromSheet } from "@/lib/kpis/syncReportSheet";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const spreadsheetId = process.env.LG_L10_KPI_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json({ ok: false, error: "LG_L10_KPI_SPREADSHEET_ID missing" }, { status: 400 });
  }

  const googleEmail = await getDefaultGoogleEmailForUser(session.user.email);
  if (!googleEmail) return NextResponse.json({ ok: false, error: "No Google account connected" }, { status: 400 });

  try {
    const out = await syncReportTableFromSheet({
      googleEmail,
      spreadsheetId,
      sheetName: process.env.LG_L10_KPI_SHEET_NAME,
      slug: L10_REPORT_SLUG,
      tableName: "L10 Reporting",
      columns: L10_REPORT_COLUMNS,
      rowKeyColumns: ["month"],
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to sync L10 sheet" }, { status: 400 });
  }
}
