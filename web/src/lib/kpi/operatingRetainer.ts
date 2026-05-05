export type OperatingRetainerEntry = {
  matterName: string;
  status: string;
  matterOwner: string;
  clientId: string;
  date: string;
  transTypeMethodRef: string;
  payorPayeeMemo: string;
  deltaUsd: number;
  balanceUsd: number;
  inferredKind: "funding" | "application" | "other";
  invoiceNumber: string | null;
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

function invoiceNumberFromMemo(text: string): string | null {
  const match = text.match(/invoice\s+#?\s*(\d+)/i);
  return match?.[1] ?? null;
}

export function parseOperatingRetainerByMatter(text: string): OperatingRetainerEntry[] {
  const rows = parseCsv(text);

  const matterName = rows.find((row) => (row[0] ?? "") === "Matter")?.[1] ?? "";
  const status = rows.find((row) => (row[0] ?? "") === "Status")?.[1] ?? "";
  const matterOwner = rows.find((row) => (row[0] ?? "") === "Matter Owner")?.[1] ?? "";
  const clientId = rows.find((row) => (row[0] ?? "") === "Client ID")?.[1] ?? "";

  const headerIdx = rows.findIndex((row) => (row[0] ?? "") === "Date" && (row[3] ?? "").includes("Increase"));
  if (headerIdx === -1) throw new Error("Could not find operating retainer transaction header row");

  return rows
    .slice(headerIdx + 1)
    .filter((row) => /^\d{4}\/\d{2}\/\d{2}$/.test(row[0] ?? ""))
    .map((row) => {
      const deltaUsd = usd(row[3]);
      const memo = row[2] ?? "";
      const invoiceNumber = invoiceNumberFromMemo(memo);
      const inferredKind = deltaUsd > 0 ? "funding" : invoiceNumber ? "application" : "other";
      return {
        matterName,
        status,
        matterOwner,
        clientId,
        date: row[0] ?? "",
        transTypeMethodRef: row[1] ?? "",
        payorPayeeMemo: memo,
        deltaUsd,
        balanceUsd: usd(row[4]),
        inferredKind,
        invoiceNumber,
      };
    });
}
