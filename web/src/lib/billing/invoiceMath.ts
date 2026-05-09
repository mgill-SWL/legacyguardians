import type { InvoiceLineType } from "@prisma/client";

export function sumLinesTotalCents(lines: { amountCents: number }[]) {
  return lines.reduce((sum, l) => sum + (l.amountCents || 0), 0);
}

export function allocationOrderRank(lineType: InvoiceLineType) {
  // Default: advanced client costs first, then fees.
  return lineType === "ADVANCED_CLIENT_COST" ? 0 : 1;
}

