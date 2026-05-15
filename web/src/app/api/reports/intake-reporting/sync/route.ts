import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/authOptions";
import { prisma } from "@/lib/prisma";
import { getDefaultGoogleEmailForUser, getIntakeKpisFromSheet } from "@/lib/kpis/intakeSheet";

export const dynamic = "force-dynamic";

const SLUG = "intake-reporting";

const SYNC_COLUMNS: { key: string; label: string; type: "NUMBER" | "PERCENT" | "TEXT" }[] = [
  { key: "scheduled_intake", label: "Scheduled Intake", type: "NUMBER" },
  { key: "live_transfer", label: "Live Transfer (Lex)", type: "NUMBER" },
  { key: "ringcentral_calls", label: "RingCentral Incoming Calls", type: "NUMBER" },
  { key: "intake_no_shows", label: "Intake Call No Shows", type: "NUMBER" },
  { key: "total_intake_calls", label: "Total Intake Calls", type: "NUMBER" },
  { key: "qualified", label: "Qualified", type: "NUMBER" },
  { key: "strategy_meeting_500_booked", label: "$500 Strategy Meeting Booked", type: "NUMBER" },
  { key: "welcome_calls_booked", label: "Welcome Calls Booked", type: "NUMBER" },
  { key: "welcome_calls_held", label: "Welcome Calls Held", type: "NUMBER" },
  { key: "paid_consult_500_held", label: "$500 Paid Consult Held", type: "NUMBER" },
  { key: "design_meetings_booked", label: "Design Meetings Booked", type: "NUMBER" },
  { key: "design_meetings_held", label: "Design Meetings Held", type: "NUMBER" },
  { key: "design_meetings_cancelled", label: "Design Meetings Cancelled", type: "NUMBER" },
  { key: "close_ea_matters", label: "Closed EA Matters", type: "NUMBER" },
  { key: "doc_tour_held", label: "Doc Tour Held", type: "NUMBER" },
  { key: "signing_held", label: "Signing Held", type: "NUMBER" },
  { key: "reviews_5_star", label: "5-star Reviews", type: "NUMBER" },
  { key: "pct_qualified", label: "% Qualified", type: "PERCENT" },
  { key: "total_conversion", label: "Total Conversion", type: "PERCENT" },
];

function normalizeHeaderLabel(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/%/g, " percent ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumberLike(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return 0;
  // allow "1,234" or "47%" etc.
  const cleaned = s
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function pickSheetNumber(
  sheetRow: { header: string; value: unknown; col: number }[] | null | undefined,
  matcher: (normalizedHeader: string) => boolean
): number {
  const sr = sheetRow || [];
  const hit = sr.find((c) => matcher(normalizeHeaderLabel(c.header)));
  return hit ? toNumberLike(hit.value) : 0;
}

async function ensureColumns(tableId: string) {
  const existing = await prisma.reportColumn.findMany({ where: { tableId } });
  const byKey = new Map(existing.map((c) => [c.key, c] as const));
  const max = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  let next = max + 1;

  for (const c of SYNC_COLUMNS) {
    const found = byKey.get(c.key);
    if (!found) {
      await prisma.reportColumn.create({
        data: {
          tableId,
          key: c.key,
          label: c.label,
          type: c.type,
          sortOrder: next++,
        },
      });
      continue;
    }

    // Keep labels/types in sync with expected settings (e.g., percent formatting).
    if (found.label !== c.label || found.type !== c.type) {
      await prisma.reportColumn.update({
        where: { id: found.id },
        data: { label: c.label, type: c.type as any },
      });
    }
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
      const sr = (r as any).sourceRow as { header: string; value: unknown; col: number }[] | undefined;

      const dataPatch = {
        // Pull everything we care about from the sheet row snapshot so header text can evolve.
        scheduled_intake: pickSheetNumber(sr, (h) => h === "scheduled intake" || h.startsWith("scheduled intake ")),
        live_transfer: pickSheetNumber(sr, (h) => h === "live transfer" || h.startsWith("live transfer ")),
        ringcentral_calls: pickSheetNumber(sr, (h) => h === "ringcentral incoming calls" || h.startsWith("ringcentral incoming calls ")),
        intake_no_shows: pickSheetNumber(sr, (h) => h === "intake call no shows" || h.startsWith("intake call no shows ")),

        total_intake_calls: r.totalIntakeCalls,

        qualified: pickSheetNumber(sr, (h) => h === "qualified" || h.startsWith("qualified ")),
        strategy_meeting_500_booked: pickSheetNumber(sr, (h) => h.startsWith("500 strategy meeting booked") || h.startsWith("$500 strategy meeting booked")),
        welcome_calls_booked: pickSheetNumber(sr, (h) => h === "welcome calls booked" || h.startsWith("welcome calls booked ")),
        welcome_calls_held: pickSheetNumber(sr, (h) => h === "welcome calls held" || h.startsWith("welcome calls held ")),
        paid_consult_500_held: pickSheetNumber(sr, (h) => h.startsWith("500 paid consult held") || h.startsWith("$500 paid consult held")),

        design_meetings_booked: pickSheetNumber(sr, (h) => h === "design meetings booked" || h.startsWith("design meetings booked ")),
        design_meetings_held: r.designMeetingsHeld,
        design_meetings_cancelled: r.designMeetingsCancelled,

        close_ea_matters: pickSheetNumber(sr, (h) => h.startsWith("closed ea matters") || h.startsWith("close ea matters")),
        doc_tour_held: pickSheetNumber(sr, (h) => h === "doc tour held" || h.startsWith("doc tour held ")),
        signing_held: pickSheetNumber(sr, (h) => h === "signing held" || h.startsWith("signing held ")),
        reviews_5_star: pickSheetNumber(sr, (h) => h.includes("star") && (h.includes("review") || h.includes("reviews"))),

        pct_qualified: r.pctQualified,
        total_conversion: r.totalConversion,
        _source: "google_sheet",
        _source_weekEnding: r.weekEnding,
        _source_year: year,
        _source_sheet_row: r.sourceRow || null,
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
