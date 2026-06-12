export type InvoicePaymentSheetKind = "detail" | "amounts" | "transactions" | "accounts";

export type InvoicePaymentDetailRow = {
  appliedDate: string;
  appliedAmountUsd: number;
  matterOwner: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmountUsd: number;
  clientMatter: string;
  feeIncomeUsd: number;
  reimbursedDirectUsd: number;
  reimbursedIndirectUsd: number;
};

export type InvoicePaymentTransactionRow = {
  appliedDate: string;
  appliedAmountUsd: number;
  source: string;
};

export type InvoicePaymentAccountTotal = {
  account: string;
  amountUsd: number;
};

export type ParsedInvoicePaymentAllocations = {
  detailRows: InvoicePaymentDetailRow[];
  transactionRows: InvoicePaymentTransactionRow[];
  accountTotals: InvoicePaymentAccountTotal[];
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

function detailRowsFromSheet(text: string): InvoicePaymentDetailRow[] {
  const rows = parseCsv(text);
  const detail: InvoicePaymentDetailRow[] = [];
  let currentAppliedDate = "";

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const first = row[0] ?? "";

    if (first.startsWith("Applied Date:")) {
      currentAppliedDate = first.replace("Applied Date:", "").trim();
      continue;
    }

    const looksLikePaymentRow = row.length >= 7 && row[2] && row[3] && row[4];
    if (!looksLikePaymentRow) continue;

    const appliedAmount = usd(row[0]);
    if (!appliedAmount) continue;

    let feeIncomeUsd = 0;
    let reimbursedDirectUsd = 0;
    let reimbursedIndirectUsd = 0;

    for (let j = i + 1; j < rows.length; j += 1) {
      const sub = rows[j];
      const label = (sub[0] ?? "").trim();
      if (!label) continue;
      if (label.startsWith("Applied Date:")) break;
      if (label === "Total") break;
      if (label.startsWith("4100:")) feeIncomeUsd += usd(sub[1]);
      if (label.startsWith("4200:")) reimbursedDirectUsd += usd(sub[1]);
      if (label.startsWith("4250:")) reimbursedIndirectUsd += usd(sub[1]);
    }

    detail.push({
      appliedDate: currentAppliedDate,
      appliedAmountUsd: appliedAmount,
      matterOwner: row[2] ?? "",
      invoiceNumber: row[3] ?? "",
      invoiceDate: row[4] ?? "",
      invoiceAmountUsd: usd(row[5]),
      clientMatter: row[6] ?? "",
      feeIncomeUsd,
      reimbursedDirectUsd,
      reimbursedIndirectUsd,
    });
  }

  return detail;
}

function transactionRowsFromSheet(text: string): InvoicePaymentTransactionRow[] {
  const rows = parseCsv(text);
  const out: InvoicePaymentTransactionRow[] = [];
  for (const row of rows) {
    const maybeDate = row[0] ?? "";
    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(maybeDate)) continue;
    out.push({
      appliedDate: maybeDate,
      appliedAmountUsd: usd(row[1]),
      source: row[3] ?? "",
    });
  }
  return out;
}

function accountTotalsFromSheet(text: string): InvoicePaymentAccountTotal[] {
  const rows = parseCsv(text);
  const out: InvoicePaymentAccountTotal[] = [];
  for (const row of rows) {
    const account = (row[0] ?? "").trim();
    if (!account.match(/^(4100:|4200:|4250:)/)) continue;
    out.push({ account, amountUsd: usd(row[1]) });
  }
  return out;
}

function keyFor(row: Pick<InvoicePaymentDetailRow, "appliedDate" | "invoiceNumber" | "matterOwner" | "appliedAmountUsd">) {
  return [row.appliedDate, row.invoiceNumber, row.matterOwner, row.appliedAmountUsd.toFixed(2)].join("|");
}

export function parseInvoicePaymentAllocations(input: {
  detailCsv: string;
  transactionsCsv: string;
  accountsCsv: string;
}): ParsedInvoicePaymentAllocations {
  const detailRows = detailRowsFromSheet(input.detailCsv);
  const transactionRows = transactionRowsFromSheet(input.transactionsCsv);
  const accountTotals = accountTotalsFromSheet(input.accountsCsv);

  const sourceQueue = new Map<string, string[]>();
  for (const tx of transactionRows) {
    const key = [tx.appliedDate, tx.appliedAmountUsd.toFixed(2)].join("|");
    const existing = sourceQueue.get(key) ?? [];
    existing.push(tx.source);
    sourceQueue.set(key, existing);
  }

  const enriched = detailRows.map((row) => {
    const key = [row.appliedDate, row.appliedAmountUsd.toFixed(2)].join("|");
    const queue = sourceQueue.get(key) ?? [];
    const source = queue.shift() ?? "";
    sourceQueue.set(key, queue);
    return { ...row, source };
  });

  return {
    detailRows: enriched,
    transactionRows,
    accountTotals,
  } as ParsedInvoicePaymentAllocations;
}
