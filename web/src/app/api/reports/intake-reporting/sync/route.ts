import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { getDefaultGoogleEmailForUser } from "@/lib/kpis/intakeSheet";
import { syncIntakeReportingFromSheet } from "@/lib/kpis/syncIntakeReporting";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  if (user.role !== "ADMIN") return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });

  const spreadsheetId = process.env.LG_INTAKE_KPI_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return NextResponse.json(
      { ok: false, error: "LG_INTAKE_KPI_SPREADSHEET_ID missing" },
      { status: 400 }
    );
  }

  const googleEmail = await getDefaultGoogleEmailForUser(session.user.email);
  if (!googleEmail) {
    return NextResponse.json(
      { ok: false, error: "No Google account connected" },
      { status: 400 }
    );
  }

  const year = new Date().getFullYear();
  const sheetNameTemplate = process.env.LG_INTAKE_KPI_SHEETNAME_TEMPLATE || "{YYYY} Intake KPIs";

  try {
    // run inside helper (reads sheet + upserts DB)
    const out = await syncIntakeReportingFromSheet({ googleEmail, spreadsheetId, year, sheetNameTemplate });
    return NextResponse.json({ ok: true, year, ...out });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to read intake KPI sheet";
    // Most sheet-related errors are user-config issues; return a readable 400.
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        context: {
          googleEmail,
          year,
          sheetName: sheetNameTemplate.replace("{YYYY}", String(year)),
          requiredHeaders: [
            "Week Ending",
            "Total Intake Calls",
            "Design Meetings HELD",
            "Design Meetings CANCELLED",
            "% Qualified",
            "Total Conversion",
          ],
        },
      },
      { status: 400 }
    );
  }
}
