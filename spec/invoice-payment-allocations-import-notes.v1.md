# Invoice Payment Allocations Import Notes (v1)

## Why this report matters
This report is the best current source for operating-side KPI recognition because it bridges:
- payment application date
- invoice number
- matter owner
- client-matter
- source of funds
- fee-vs-cost decomposition

## Workbook sheet roles

### Sheet 1 — Detail
Use as the primary import sheet.

Per applied payment block it provides:
- `Applied Amt`
- `Matter Owner`
- `Inv #`
- `Inv Date`
- `Inv Amt`
- `Client-Matter`
- one or more account rows underneath, e.g.:
  - `4100:Fee Income (Income)`
  - `4200:Reimbursed Client Costs (Direct) (Income)`
  - `4250:Inhouse Reimbursed Client Costs (Indirect) (Income)`

This lets us split one applied payment into:
- fee-income portion
- reimbursed-cost portion

### Sheet 2 — Summary of Invoice Applied Amounts
Useful summary/check report:
- `Applied Date`
- `Applied Amt`
- `Matter Owner`
- `Inv #`
- `Inv Date`
- `Inv Amt`
- `Client-Matter`

### Sheet 3 — Summary of Invoice Applied Transactions
Adds source-of-funds classification:
- `From Trust`
- `New Payment`
- `Operating Retainer`

This is critical metadata for downstream financial modeling.

### Sheet 4 — Summary By Account
Useful validation totals by account:
- `4100`
- `4200`
- `4250`

## Import design

### Suggested import batch type
Add/report type:
- `INVOICE_PAYMENT_ALLOCATIONS`

### Suggested recognition model
For each applied payment block on Sheet 1:
- create one recognition record keyed by:
  - applied date
  - invoice number
  - matter owner
  - client-matter
- attach source-of-funds classification from Sheet 3
- attach account-breakdown totals from Sheet 1

### KPI rule
For attorney collected-revenue KPIs:
- count only the `4100` amount
- exclude `4200` and `4250`

### Recognition date
Use:
- `Applied Date`

This is better than deposit date because it reflects when the payment was actually applied to revenue-bearing invoice balances.

## Why this helps
- solves bundled processor deposit ambiguity
- handles trust / new payment / operating-retainer pathways consistently
- preserves fee-vs-cost separation
- aligns KPI recognition with actual invoice application behavior in CosmoLex
