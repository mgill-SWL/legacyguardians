import { prisma } from "@/lib/prisma";
import { googleSheetsValuesBatchGet } from "@/lib/google/sheets";

const REQUIRED_HEADERS = [
  "Week Ending",
  "Total Intake Calls",
  "Design Meetings HELD",
  "Design Meetings CANCELLED",
  "% Qualified",
  "Total Conversion",
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

function normalizeHeaderLabel(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    // Drop parenthetical notes ("Week Ending (Friday)" -> "Week Ending")
    .replace(/\([^)]*\)/g, " ")
    // Make percent stable
    .replace(/%/g, " percent ")
    // Collapse punctuation to spaces
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const REQUIRED_HEADER_MATCHERS: Record<RequiredHeader, (norm: string) => boolean> = {
  "Week Ending": (s) => s === "week ending" || s.startsWith("week ending "),
  "Total Intake Calls": (s) => s === "total intake calls" || s.startsWith("total intake calls "),
  "Design Meetings HELD": (s) => s === "design meetings held" || s.startsWith("design meetings held "),
  "Design Meetings CANCELLED": (s) =>
    s === "design meetings cancelled" ||
    s.startsWith("design meetings cancelled ") ||
    s === "design meetings canceled" ||
    s.startsWith("design meetings canceled "),
  "% Qualified": (s) =>
    s === "percent qualified" ||
    s.startsWith("percent qualified ") ||
    s === "pct qualified" ||
    s.startsWith("pct qualified "),
  "Total Conversion": (s) => s === "total conversion" || s.startsWith("total conversion "),
};

function resolveRequiredHeaderIndexes(row: unknown[]): Record<RequiredHeader, number> | null {
  const cells = (row || []).map((v) => {
    const raw = String(v ?? "").trim();
    const norm = normalizeHeaderLabel(raw);
    return { raw, norm };
  });

  const out = {} as Record<RequiredHeader, number>;
  for (const h of REQUIRED_HEADERS) {
    const match = REQUIRED_HEADER_MATCHERS[h];
    const col = cells.findIndex((c) => c.raw && match(c.norm));
    if (col < 0) return null;
    out[h] = col;
  }
  return out;
}

function excelSerialToIsoDate(serial: number) {
  // Google Sheets serial dates are days since 1899-12-30 (same as Excel for modern dates).
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + serial * 24 * 60 * 60 * 1000;
  const d = new Date(ms);
  // Normalize to YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function parseWeekEnding(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return excelSerialToIsoDate(v);

  if (typeof v === "string") {
    const s = v.trim();
    // Common formats from sheets: M/D/YYYY or MM/DD/YYYY
    const m = s.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
    if (m) {
      const mm = Number(m[1]);
      const dd = Number(m[2]);
      const yyyy = Number(m[3]);
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        const d = new Date(Date.UTC(yyyy, mm - 1, dd));
        return d.toISOString().slice(0, 10);
      }
    }
    // ISO already
    const iso = s.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
    if (iso) return s;

    // Fallback parse (last resort)
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
  }

  return null;
}

function toNumber(v: any) {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type IntakeKpiSheetRow = {
  weekEnding: string; // YYYY-MM-DD
  totalIntakeCalls: number;
  designMeetingsHeld: number;
  designMeetingsCancelled: number;
  pctQualified: number; // 0-1 if sheet uses percent, or 0-100 if typed that way; we keep raw numeric.
  totalConversion: number; // raw numeric
  // Raw row snapshot for future slicing/dicing across additional columns.
  sourceRow?: { header: string; value: any; col: number }[];
};

export async function getDefaultGoogleEmailForUser(userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) return null;

  const byUser = await prisma.googleConnection.findFirst({
    where: { connectedByUserId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  if (byUser) return byUser.googleEmail;

  const any = await prisma.googleConnection.findFirst({ orderBy: { updatedAt: "desc" } });
  return any?.googleEmail || null;
}

export async function getIntakeKpisFromSheet({
  googleEmail,
  spreadsheetId,
  year,
  sheetNameTemplate = "{YYYY} Intake KPIs",
}: {
  googleEmail: string;
  spreadsheetId: string;
  year: number;
  sheetNameTemplate?: string;
}) {
  const sheetName = sheetNameTemplate.replace("{YYYY}", String(year));

  // Pull a wide range and locate headers dynamically so inserts don't break us.
  // If this ever grows, we can tighten to known columns or switch to a dedicated KPI_OUTPUT tab.
  const range = `'${sheetName.replaceAll("'", "''")}'!A1:AZ1000`;

  const batch = await googleSheetsValuesBatchGet({
    googleEmail,
    spreadsheetId,
    ranges: [range],
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = batch.valueRanges?.[0]?.values || [];
  if (!values.length) {
    return { sheetName, rows: [] as IntakeKpiSheetRow[] };
  }

  // Find the header row.
  let headerRowIdx = -1;
  let headerMap: Record<RequiredHeader, number> | null = null;
  for (let i = 0; i < Math.min(values.length, 50); i++) {
    const row = values[i] || [];
    const map = resolveRequiredHeaderIndexes(row);
    if (map) {
      headerRowIdx = i;
      headerMap = map;
      break;
    }
  }
  if (headerRowIdx < 0 || !headerMap) {
    throw new Error(`Could not find required headers in sheet tab "${sheetName}". Expected: ${REQUIRED_HEADERS.join(", ")}`);
  }

  const idx = (h: RequiredHeader) => headerMap![h];
  const rows: IntakeKpiSheetRow[] = [];

  const headerRow: unknown[] = values[headerRowIdx] || [];
  const headers = headerRow.map((h) => String(h ?? "").trim());

  for (let r = headerRowIdx + 1; r < values.length; r++) {
    const row = values[r] || [];
    const weekEnding = parseWeekEnding(row[idx("Week Ending")]);
    if (!weekEnding) continue; // skip subtotal/month rows + blanks

    rows.push({
      weekEnding,
      totalIntakeCalls: toNumber(row[idx("Total Intake Calls")]),
      designMeetingsHeld: toNumber(row[idx("Design Meetings HELD")]),
      designMeetingsCancelled: toNumber(row[idx("Design Meetings CANCELLED")]),
      pctQualified: toNumber(row[idx("% Qualified")]),
      totalConversion: toNumber(row[idx("Total Conversion")]),
      sourceRow: headers
        .map((header, col) => ({ header, col, value: row[col] ?? null }))
        .filter((x) => x.header),
    });
  }

  // Sort ascending by weekEnding.
  rows.sort((a, b) => (a.weekEnding < b.weekEnding ? -1 : a.weekEnding > b.weekEnding ? 1 : 0));

  return { sheetName, rows };
}
