export type BillingAccountType =
  | "TRUST"
  | "OPERATING"
  | "ACCOUNTS_RECEIVABLE"
  | "REVENUE"
  | "EXPENSE"
  | "OTHER";

export type TrustEventType = "TRUST_DEPOSIT" | "TRUST_APPLIED" | "TRANSFER" | "REFUND";

export function isTrustRelatedEventType(eventType: string): eventType is TrustEventType {
  return eventType === "TRUST_DEPOSIT" || eventType === "TRUST_APPLIED" || eventType === "TRANSFER" || eventType === "REFUND";
}

/**
 * Preferred trust delta: infer from from/to account types.
 * Fallback: infer from eventType if accounts aren't present.
 */
export function trustDeltaCents(args: {
  eventType: string;
  amountCents: number;
  fromAccountType?: BillingAccountType | null;
  toAccountType?: BillingAccountType | null;
}): number {
  const { eventType, amountCents, fromAccountType, toAccountType } = args;

  const fromTrust = fromAccountType === "TRUST";
  const toTrust = toAccountType === "TRUST";

  if (fromTrust || toTrust) {
    return (toTrust ? amountCents : 0) + (fromTrust ? -amountCents : 0);
  }

  // Legacy fallback (older rows may not have from/to account IDs set)
  if (!isTrustRelatedEventType(eventType)) return 0;
  return eventType === "TRUST_DEPOSIT" ? amountCents : -amountCents;
}

