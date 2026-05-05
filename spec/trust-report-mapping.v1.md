# Trust Report Mapping (v1)

## What the uploaded reports show

### Primary source: Trust Ledger Transactions
Observed row structure per matter block:
- Matter
- Matter Owner
- Client ID
- transaction table with columns:
  - `Date`
  - `Bank`
  - `Tran Type / Method / Ref#`
  - `Payor/Payee / Memo`
  - `Increase / Decrease`
  - `Balance`
  - `Status`
- per-matter summary:
  - total credits (increases)
  - total debits (decreases)
  - ending balance
- per-bank balance footer

Example observed transaction:
- Date: `2026/04/16`
- Bank: `Burke and Herbert - B&H IOLTA`
- Transaction type/method: `Withdrawal / Bank Transfer`
- Payor/Payee + memo: `Speedwell Law / Trust to General Transfer`
- Increase/Decrease: `(4,070.00)`
- Balance: `0.00`
- Status: `Entered`

### Supporting source: Client's Trust Ledger
Observed columns:
- `Date`
- `Bank`
- `Payee/Payor`
- `Method`
- `Memo`
- `Deposit`
- `Withdrawal`
- `Balance`

This is useful because it cleanly splits inflow vs outflow.

### Supporting source: Trust Ledger Activity Summary
Observed matter rollup:
- `Matter`
- `Matter Owner`
- `Beginning Balance`
- `Increase`
- `Decrease`
- `Ending Balance`

This is good for validating batch totals.

### Supporting source: Trust Ledger Balance
Observed snapshot columns:
- `Client-Matter`
- `Matter Owner`
- `Bank`
- `Balance`
- `Last Activity`
- `Current Status`

This is good for validating current balances.

## Mapping into DB financial events

### Trust deposit / receipt
When trust reports show a deposit/increase:
- `MatterFinancialEvent.eventType = TRUST_DEPOSIT`
- `amountCents = deposit amount`
- `toAccount = trust account`
- `sourceSystem = COSMOLEX`

### Trust disbursement / outflow
When trust reports show a withdrawal/decrease:
- default `MatterFinancialEvent.eventType = TRUST_APPLIED`
- `amountCents = withdrawal amount`
- `fromAccount = trust account`
- `sourceSystem = COSMOLEX`

### Trust-to-general / trust-to-operating transfer
If memo/method indicates transfer from trust to firm general/operating:
- this should be treated as a **collection event** in business/KPI terms
- bookkeeping shape:
  - `MatterFinancialEvent.eventType = TRANSFER`
  - `fromAccount = trust account`
  - `toAccount = operating account` (if known)
- KPI interpretation:
  - count the transferred amount as **collected**
- memo should preserve the transfer note (`Trust to General Transfer`, etc.)

### Refund / return of trust funds
If memo/type indicates return to client or refund:
- `MatterFinancialEvent.eventType = REFUND`

## Classification heuristics (v1)
Use transaction text in this order:
1. explicit transfer language (`transfer`, `trust to general`, `trust to operating`) -> `TRANSFER` and mark as **collected for KPI purposes**
2. explicit refund/return language -> `REFUND`
3. positive deposit/receipt -> `TRUST_DEPOSIT`
4. negative withdrawal/disbursement -> `TRUST_APPLIED`

## Trust Receipts Journal mapping
The uploaded Trust Receipts Journal is very clean and useful.

Observed columns:
- `Date`
- `Received From`
- `Client`
- `Purpose of Funds`
- `Amount`
- `Method`

Use it as a primary source for **trust inflow** events:
- `MatterFinancialEvent.eventType = TRUST_DEPOSIT`
- `eventDate = Date`
- `amountCents = Amount`
- `toAccount = trust account`
- `sourceSystem = COSMOLEX`
- `sourceReference = Trust Receipts Journal`
- preserve:
  - payor in `sourceClientName` or notes/additional source field later
  - method (`Credit Card`, `Direct Deposit`) in notes or a future payment-method field

Business interpretation:
- this is **money received into trust**
- it should not count as collected until it is either:
  - directly recognized as a payment-received/collected event under your accounting logic, or
  - transferred from trust to operating/general when earned

## Trust Disbursements Journal mapping
The uploaded Trust Disbursements Journal is strong evidence for trust-to-operating collection recognition.

Observed columns:
- `Date`
- `Method / #`
- `Paid To`
- `Client`
- `Purpose of Payment`
- `Amount`

Observed April sample behavior:
- `Paid To = Speedwell Law`
- `Purpose of Payment = Trust to General Transfer`
- amounts are negative/outflow amounts from trust

Use it as a primary source for **earned funds leaving trust**:
- bookkeeping shape:
  - `MatterFinancialEvent.eventType = TRANSFER`
  - `fromAccount = trust account`
  - `toAccount = operating/general account`
- KPI/business shape:
  - count the amount as **collected**
- preserve:
  - payment method (`Bank Transfer`)
  - payee (`Speedwell Law`)
  - purpose text (`Trust to General Transfer`)

This report is especially useful because it expresses the collection event much more cleanly than the generic trust ledger transaction export.

## Trust Transfer Record mapping
The uploaded Trust Transfer Record sample returned:
- `No data available`

So for the April sample set, the operational transfer activity appears to be represented through the Trust Disbursements Journal rather than a separate transfer-record export.

This means v1 should not depend on the transfer-record report existing for every period.

## Suggested future imports to improve classification
Priority order:
1. Trust Receipts Journal
2. Trust Disbursements Journal
3. Trust Transfer Record
4. Trust Journal

These should make event classification much more reliable than relying only on free-text transaction memo fields.
