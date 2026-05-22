import { prisma } from "@/lib/prisma";
import { googleSheetsGetMetadata, googleSheetsValuesBatchGet } from "@/lib/google/sheets";

type ReportColumnType = "TEXT" | "NUMBER" | "CURRENCY" | "PERCENT" | "DATE";

export type ReportSheetColumn = {
  key: string;
  label: string;
  type: ReportColumnType;
};

function normalizeLabel(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function parseNumberLike(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const cleaned = String(v)
    .trim()
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/%/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseCellValue(type: ReportColumnType, v: unknown) {
  if (type === "NUMBER" || type === "CURRENCY") return parseNumberLike(v);
  if (type === "PERCENT") {
    const n = parseNumberLike(v);
    if (n == null) return null;
    return n > 1 ? n / 100 : n;
  }
  if (type === "DATE") return String(v ?? "").trim() || null;
  return String(v ?? "").trim();
}

const MONTH_NAMES = new Set([
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
]);

function parseMonthSectionLabel(v: unknown) {
  const label = String(v ?? "").trim();
  if (!label) return null;
  const normalized = label.toLowerCase().replace(/[^a-z]+/g, " ").trim();
  if (!MONTH_NAMES.has(normalized)) return null;
  return normalized.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function normalizeStopLabel(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findHeaderRow(values: unknown[][], columns: ReportSheetColumn[]) {
  const expected = new Set(columns.flatMap((c) => [normalizeLabel(c.label), normalizeLabel(c.key)]));

  let best: { rowIdx: number; score: number } | null = null;
  for (let rowIdx = 0; rowIdx < Math.min(values.length, 50); rowIdx++) {
    const row = values[rowIdx] || [];
    let score = 0;
    for (const cell of row) {
      if (expected.has(normalizeLabel(cell))) score++;
    }
    if (!best || score > best.score) best = { rowIdx, score };
  }

  if (!best || best.score < 2) {
    throw new Error("Could not find a header row matching this KPI table's columns.");
  }
  return best.rowIdx;
}

function resolveColumnIndexes(headerRow: unknown[], columns: ReportSheetColumn[]) {
  const headerByNorm = new Map<string, number>();
  headerRow.forEach((h, idx) => {
    const norm = normalizeLabel(h);
    if (norm && !headerByNorm.has(norm)) headerByNorm.set(norm, idx);
  });

  const out = new Map<string, number>();
  for (const c of columns) {
    const byLabel = headerByNorm.get(normalizeLabel(c.label));
    const byKey = headerByNorm.get(normalizeLabel(c.key));
    const idx = byLabel ?? byKey;
    if (idx != null) out.set(c.key, idx);
  }
  return out;
}

async function ensureReportTable(slug: string, name: string, columns: ReportSheetColumn[], obsoleteColumnKeys: string[] = []) {
  const table =
    (await prisma.reportTable.findUnique({ where: { slug } })) ||
    (await prisma.reportTable.create({
      data: {
        slug,
        name,
        columns: { create: columns.map((c, sortOrder) => ({ ...c, sortOrder })) },
        rows: { create: [] },
      },
    }));

  const existing = await prisma.reportColumn.findMany({ where: { tableId: table.id } });
  const byKey = new Map(existing.map((c) => [c.key, c] as const));
  for (const key of obsoleteColumnKeys) {
    const found = byKey.get(key);
    if (!found) continue;
    await prisma.reportColumn.delete({ where: { id: found.id } });
    byKey.delete(key);
  }
  const max = existing.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  let next = max + 1;

  for (const c of columns) {
    const found = byKey.get(c.key);
    if (!found) {
      await prisma.reportColumn.create({ data: { tableId: table.id, ...c, sortOrder: next++ } });
    } else if (found.label !== c.label || found.type !== c.type) {
      await prisma.reportColumn.update({ where: { id: found.id }, data: { label: c.label, type: c.type } });
    }
  }

  return table;
}

async function resolveSheetName({
  googleEmail,
  spreadsheetId,
  sheetName,
}: {
  googleEmail: string;
  spreadsheetId: string;
  sheetName?: string;
}) {
  if (sheetName?.trim()) return sheetName.trim();
  const metadata = await googleSheetsGetMetadata({ googleEmail, spreadsheetId });
  const firstVisible = [...(metadata.sheets || [])]
    .sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))
    .find((s) => !s.properties?.hidden && s.properties?.title);
  if (!firstVisible?.properties?.title) throw new Error("No visible sheet tabs found.");
  return firstVisible.properties.title;
}

export async function syncReportTableFromSheet({
  googleEmail,
  spreadsheetId,
  sheetName,
  slug,
  tableName,
  columns,
  rowKeyColumns,
  sectionColumnKey,
  obsoleteColumnKeys,
  stopAtFirstColumnLabels,
}: {
  googleEmail: string;
  spreadsheetId: string;
  sheetName?: string;
  slug: string;
  tableName: string;
  columns: ReportSheetColumn[];
  rowKeyColumns: string[];
  sectionColumnKey?: string;
  obsoleteColumnKeys?: string[];
  stopAtFirstColumnLabels?: string[];
}) {
  const resolvedSheetName = await resolveSheetName({ googleEmail, spreadsheetId, sheetName });
  const range = `'${resolvedSheetName.replaceAll("'", "''")}'!A1:AZ2000`;
  const batch = await googleSheetsValuesBatchGet({
    googleEmail,
    spreadsheetId,
    ranges: [range],
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const values = batch.valueRanges?.[0]?.values || [];
  if (!values.length) return { sheetName: resolvedSheetName, created: 0, updated: 0, totalSheetRows: 0, mappedColumns: 0 };

  const headerRowIdx = findHeaderRow(values, columns);
  const colIndexes = resolveColumnIndexes(values[headerRowIdx] || [], columns);
  const table = await ensureReportTable(slug, tableName, columns, obsoleteColumnKeys);
  const existingRows = await prisma.reportRow.findMany({ where: { tableId: table.id } });
  const byRowKey = new Map(existingRows.map((r) => [r.rowKey, r] as const));
  const stopLabels = new Set((stopAtFirstColumnLabels || []).map(normalizeStopLabel).filter(Boolean));

  let created = 0;
  let updated = 0;
  let totalSheetRows = 0;
  let currentSectionLabel: string | null = null;

  for (let r = headerRowIdx + 1; r < values.length; r++) {
    const row = values[r] || [];
    if (!row.some((v) => String(v ?? "").trim())) continue;
    if (stopLabels.has(normalizeStopLabel(row[0]))) break;

    if (sectionColumnKey) {
      const sectionLabel = parseMonthSectionLabel(row[0]);
      const hasOtherValues = row.slice(1).some((v) => String(v ?? "").trim());
      if (sectionLabel && !hasOtherValues) {
        currentSectionLabel = sectionLabel;
        continue;
      }
    }

    const data: Record<string, unknown> = {};
    for (const c of columns) {
      const idx = colIndexes.get(c.key);
      if (idx == null) continue;
      data[c.key] = parseCellValue(c.type, row[idx]);
    }
    if (sectionColumnKey && currentSectionLabel) data[sectionColumnKey] = currentSectionLabel;

    if (String(data.timekeeper ?? "").trim().toLowerCase() === "total") continue;

    const rowKeyParts = rowKeyColumns.map((key) => String(data[key] ?? "").trim()).filter(Boolean);
    if (rowKeyParts.length === 0) continue;

    const label = rowKeyParts.join(" - ");
    const rowKey = slugify(label) || `sheet-row-${r + 1}`;
    const dataPatch = {
      ...data,
      _source: "google_sheet",
      _source_spreadsheet_id: spreadsheetId,
      _source_sheet_name: resolvedSheetName,
      _source_sheet_row: r + 1,
    };

    const existing = byRowKey.get(rowKey);
    if (existing) {
      const existingData = existing.data && typeof existing.data === "object" && !Array.isArray(existing.data) ? existing.data : {};
      await prisma.reportRow.update({
        where: { id: existing.id },
        data: { label, data: { ...existingData, ...dataPatch } },
      });
      updated++;
    } else {
      const createdRow = await prisma.reportRow.create({
        data: {
          tableId: table.id,
          rowKey,
          label,
          sortOrder: existingRows.length + created,
          data: dataPatch,
        },
      });
      byRowKey.set(rowKey, createdRow);
      created++;
    }
    totalSheetRows++;
  }

  return { sheetName: resolvedSheetName, created, updated, totalSheetRows, mappedColumns: colIndexes.size };
}
