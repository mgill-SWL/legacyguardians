import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { getDefaultGoogleEmailForUser, getIntakeKpisFromSheet } from "@/lib/kpis/intakeSheet";

export const dynamic = "force-dynamic";

const SLUG = "intake-reporting";

const REQUIRED_COLUMNS: { key: string; label: string; type: "NUMBER" | "PERCENT" | "TEXT" }[] = [
  { key: "total_intake_calls", label: "Total Intake Calls", type: "NUMBER" },
  { key: "design_meetings_held", label: "Design Meetings Held", type: "NUMBER" },
  { key: "design_meetings_cancelled", label: "Design Meetings Cancelled", type: "NUMBER" },
  { key: "pct_qualified", label: "% Qualified", type: "PERCENT" },
  { key: "total_conversion", label: "Total Conversion", type: "NUMBER" },
];

async function ensureColumns(tableId: string) {
  const existing = await prisma.reportColumn.findMany({ where: { tableId } });
  const byKey = new Set(existing.map((c) => c.key));
  const max = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  let next = max + 1;

  for (const c of REQUIRED_COLUMNS) {
    if (byKey.has(c.key)) continue;
    await prisma.reportColumn.create({
      data: {
        tableId,
        key: c.key,
        label: c.label,
        type: c.type,
        sortOrder: next++,
      },
    });
  }
}

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

  let rows: any[] = [];
  try {
    const out = await getIntakeKpisFromSheet({
      googleEmail,
      spreadsheetId,
      year,
      sheetNameTemplate,
    });
    rows = out.rows;
  } catch (e: any) {
    const msg = e?.message || "Failed to read intake KPI sheet";
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

  try {
    const table = await prisma.reportTable.findUnique({
      where: { slug: SLUG },
      include: { columns: true, rows: true },
    });

    const ensured = table
      ? table
      : await prisma.reportTable.create({
          data: {
            slug: SLUG,
            name: "Intake Reporting",
            columns: { create: [] },
            rows: { create: [] },
          },
          include: { columns: true, rows: true },
        });

    await ensureColumns(ensured.id);

    const existingRows = await prisma.reportRow.findMany({ where: { tableId: ensured.id } });
    const byRowKey = new Map(existingRows.map((r) => [r.rowKey, r] as const));

    let created = 0;
    let updated = 0;

    for (const r of rows) {
      const dataPatch = {
        total_intake_calls: r.totalIntakeCalls,
        design_meetings_held: r.designMeetingsHeld,
        design_meetings_cancelled: r.designMeetingsCancelled,
        pct_qualified: r.pctQualified,
        total_conversion: r.totalConversion,
        _source: "google_sheet",
        _source_weekEnding: r.weekEnding,
        _source_year: year,
      } as any;

      const existing = byRowKey.get(r.weekEnding);
      if (existing) {
        await prisma.reportRow.update({
          where: { id: existing.id },
          data: {
            label: existing.label || r.weekEnding,
            data: { ...(existing.data as any), ...dataPatch },
          },
        });
        updated++;
      } else {
        await prisma.reportRow.create({
          data: {
            tableId: ensured.id,
            rowKey: r.weekEnding,
            label: r.weekEnding,
            sortOrder: existingRows.length + created,
            data: dataPatch,
          },
        });
        created++;
      }
    }

    return NextResponse.json({ ok: true, year, created, updated, totalSheetRows: rows.length });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || "Sync failed",
      },
      { status: 500 }
    );
  }
}
