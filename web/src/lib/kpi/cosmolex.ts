export type CosmoLexReportKind = "collections" | "billings";

export type ParsedCosmoLexRow = {
  invoiceNumber: string;
  invoiceDate: string | null;
  paymentDate: string | null;
  timekeeper: string;
  client: string;
  matter: string;
  matterFileNumber: string | null;
  billedFeeUsd: number;
  collectedFeeUsd: number;
};

export type ParsedCosmoLexReport = {
  kind: CosmoLexReportKind;
  rangeStart: string | null;
  rangeEnd: string | null;
  sourceRows: ParsedCosmoLexRow[];
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.map((r) => r.map((c) => c.trim()));
}

function extractDateRange(rows: string[][]): { rangeStart: string | null; rangeEnd: string | null } {
  const joined = rows.slice(0, 8).map((r) => r.filter(Boolean).join(" "));
  const regex = /(\d{4}\/\d{2}\/\d{2})\s*-\s*(\d{4}\/\d{2}\/\d{2})/;
  for (const line of joined) {
    const match = line.match(regex);
    if (match) {
      return {
        rangeStart: match[1].replaceAll("/", "-"),
        rangeEnd: match[2].replaceAll("/", "-"),
      };
    }
  }
  return { rangeStart: null, rangeEnd: null };
}

function findHeaderRow(rows: string[][]): number {
  const required = ["timekeeper", "client", "matter", "billed fee", "collected fee"];
  const index = rows.findIndex((row) => {
    const normalized = row.map((cell) => cell.trim().toLowerCase());
    return required.every((label) => normalized.includes(label));
  });
  if (index === -1) throw new Error("Could not find CosmoLex header row");
  return index;
}

function money(value: string | undefined): number {
  const cleaned = (value ?? "").replaceAll(",", "").trim();
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: string | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(raw)) return raw.replaceAll("/", "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function pick(row: string[], header: string[], ...names: string[]): string {
  for (const name of names) {
    const idx = header.findIndex((cell) => cell.trim().toLowerCase() === name.toLowerCase());
    if (idx >= 0) return row[idx] ?? "";
  }
  return "";
}

export function parseCosmoLexReport(text: string, kind: CosmoLexReportKind): ParsedCosmoLexReport {
  const rows = parseCsv(text);
  const { rangeStart, rangeEnd } = extractDateRange(rows);
  const headerIndex = findHeaderRow(rows);
  const header = rows[headerIndex];
  const dataRows = rows.slice(headerIndex + 1).filter((row) => row.some((cell) => cell.trim().length > 0));

  const sourceRows: ParsedCosmoLexRow[] = dataRows
    .map((row) => ({
      invoiceNumber: pick(row, header, "Invoice #", "Invoice#"),
      invoiceDate: normalizeDate(pick(row, header, "Invoice Date")),
      paymentDate: normalizeDate(pick(row, header, "Payment Date")),
      timekeeper: pick(row, header, "Timekeeper"),
      client: pick(row, header, "Client"),
      matter: pick(row, header, "Matter"),
      matterFileNumber: pick(row, header, "Matter File Number", "Matter File#") || null,
      billedFeeUsd: money(pick(row, header, "Billed Fee")),
      collectedFeeUsd: money(pick(row, header, "Collected Fee")),
    }))
    .filter((row) => row.timekeeper && row.client && row.matter);

  return { kind, rangeStart, rangeEnd, sourceRows };
}

export function usdToCents(value: number): number {
  return Math.round(value * 100);
}
