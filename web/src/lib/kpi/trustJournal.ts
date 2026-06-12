export type TrustReceiptRow = {
  date: string;
  receivedFrom: string;
  clientMatter: string;
  purposeOfFunds: string;
  amountUsd: number;
  method: string;
};

export type TrustDisbursementRow = {
  date: string;
  methodRef: string;
  paidTo: string;
  clientMatter: string;
  purposeOfPayment: string;
  amountUsd: number;
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
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function usd(value: string | undefined): number {
  const raw = (value ?? "").replaceAll(",", "").replaceAll(" ", "").trim();
  if (!raw) return 0;
  const negative = raw.includes("(") || raw.startsWith("-");
  const parsed = Number.parseFloat(raw.replace(/[()]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function findHeaderRow(rows: string[][], firstCell: string): number {
  const idx = rows.findIndex((row) => (row[0] ?? "").trim() === firstCell);
  if (idx === -1) throw new Error(`Could not find header row starting with ${firstCell}`);
  return idx;
}

export function parseTrustReceiptsJournal(text: string): TrustReceiptRow[] {
  const rows = parseCsv(text);
  const headerIdx = findHeaderRow(rows, "Date");
  return rows
    .slice(headerIdx + 1)
    .filter((row) => /^\d{4}\/\d{2}\/\d{2}$/.test(row[0] ?? ""))
    .map((row) => ({
      date: row[0] ?? "",
      receivedFrom: row[1] ?? "",
      clientMatter: row[2] ?? "",
      purposeOfFunds: row[3] ?? "",
      amountUsd: usd(row[4]),
      method: row[5] ?? "",
    }));
}

export function parseTrustDisbursementsJournal(text: string): TrustDisbursementRow[] {
  const rows = parseCsv(text);
  const headerIdx = findHeaderRow(rows, "Date");
  return rows
    .slice(headerIdx + 1)
    .filter((row) => /^\d{4}\/\d{2}\/\d{2}$/.test(row[0] ?? ""))
    .map((row) => ({
      date: row[0] ?? "",
      methodRef: row[1] ?? "",
      paidTo: row[2] ?? "",
      clientMatter: row[3] ?? "",
      purposeOfPayment: row[4] ?? "",
      amountUsd: usd(row[5]),
    }));
}
