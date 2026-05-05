# Operating Account V1 Plan

## Goal
Extend the bookkeeping/KPI foundation from trust activity into the operating account so Legacy Guardians can track:
- earned revenue landing in operating
- non-trust direct payments
- refunds / chargebacks / reversals
- operating-account reconciliation inputs
- KPI-quality collected revenue numbers

## Why this is harder
Operating account activity mixes multiple classes of transactions:
- trust-to-operating transfers
- direct client payments
- earned fee deposits
- expense payments
- merchant fees
- refunds
- bank noise unrelated to KPI revenue

So unlike trust, we need stronger classification rules to separate:
- revenue events
- non-revenue bank activity
- bookkeeping-only adjustments

## V1 objective
For V1, the operating-account import does **not** need to solve full accounting.
It needs to answer these questions reliably:
1. What money hit operating that should count as collected revenue?
2. Which matter/client did it belong to?
3. Which attorney/timekeeper should get KPI credit?
4. What should be excluded from collected KPIs?

## Recommended source reports to request from CosmoLex / bookkeeping
Priority order:
1. **Invoice Payment Allocations**
2. operating bank transaction detail / operating account journal
3. deposit detail report
4. client payments / payment receipts report
5. refund / reversed payment report
6. earned fees or fee allocation report if available

Current understanding after reviewing April exports:
- `Invoice Payment Allocations` is the strongest operating-side KPI source because it ties together:
  - applied date
  - applied amount
  - invoice
  - matter owner
  - source of funds (`From Trust`, `New Payment`, `Operating Retainer`)
  - account decomposition (`4100`, `4200`, `4250`)
- `Operating Retainer By Matter` should be treated as a **liability-ledger source**, not a revenue ledger.
- Negative balances in that report likely indicate operating retainer over-application / deficit at the matter-liability level, not necessarily a negative matter economics signal.

## Event types to support
Use existing / near-existing event categories:
- `PAYMENT_RECEIVED`
- `OPERATING_DEPOSIT`
- `TRANSFER`
- `REFUND`
- `WRITE_OFF`

Interpretation:
- direct client payment into operating -> `PAYMENT_RECEIVED` or `OPERATING_DEPOSIT`
- direct client payment into `2320:Client General Retainer (Operating)` -> liability-side operating retainer receipt, not yet necessarily earned revenue
- trust to operating earned transfer -> `TRANSFER` and counts as collected
- refund back out -> `REFUND`
- matter-to-matter movement should never hit operating KPI revenue
- `--Split--` invoice-payment rows may need decomposition across fee income and reimbursed-cost income lines

## KPI revenue inclusion rules (draft)
Count as collected:
- `PAYMENT_RECEIVED`
- `TRANSFER` from trust -> operating/general
- qualifying direct operating deposits tied to client payments
- direct operating receipts that hit `4100:Fee Income`

Exclude from collected:
- matter-to-matter transfers
- owner contributions
- bank corrections
- internal transfers unrelated to earned fees
- raw deposits to `2320:Client General Retainer (Operating)` until earned/applied
- merchant fee offsets

Separate but trackable:
- `4200:Reimbursed Client Costs (Direct)`
- `4250:Inhouse Reimbursed Client Costs (Indirect)`
These should be tracked separately and **excluded from attorney collected-revenue KPIs**.

## Import/reconciliation workflow
1. import operating report batch
2. classify rows into candidate event types
3. attempt matter match using:
   - matter file number
   - invoice number
   - client-matter name
4. assign attribution:
   - invoice/timekeeper attribution when available
   - otherwise matter-level lead attorney fallback
5. mark unresolved rows for human review

## Human-review queue needed
Some rows will need manual resolution.
Create a review queue for:
- unmatched matter
- ambiguous client name
- uncertain revenue classification
- refund without linked original payment
- deposit bundle containing multiple matters

## Suggested admin UI additions
- `/admin/imports/operating`
- `/admin/reconciliation/financial-events`
- `/admin/kpis/review`

## What the April General Ledger already tells us
- Trust-to-operating movements are posted as `Trust to General Transfer` into `4100:Fee Income` and clearly support your rule that these count as collected.
- Some client money goes directly into operating as `2320:Client General Retainer (Operating)`; this implies not all client cash starts in trust.
- Some operating receipts are invoice-linked (`Pmt for Invoice# ...`) and may land as `--Split--` entries, meaning one receipt can span fee income and reimbursed-cost categories.
- Reimbursed costs appear separately in `4200` and `4250`, which suggests KPI logic should decide whether to include only fee income or fee income plus reimbursed cost recovery.
- The ledger also contains ordinary expense noise, so a dedicated classification layer is definitely necessary.

## Clarifications from Misha
- Card processing fees have historically been absorbed by the firm, but CosmoLex Pay can now automatically charge them to the client. Payment-processing treatment may evolve again if the firm later moves toward Stripe or another processor.
- Refunds should be operationally refundable from the relevant source account; the remaining design question is KPI/accounting treatment, not whether refunds are possible.
- One-off/multi-payor operational work commonly runs through a single `General Matters` client matter, with invoices specifying the one-off service and the payor's name.
- The system will also need check-printing capability later, with a preferred layout of one check on 8.5x11 stock and two perforated receipt stubs below.

## Remaining open questions for Misha
- Which operating-account reports are available/exportable from CosmoLex beyond the General Ledger?
- If a single payment is later split across multiple invoices or matters, what attribution rule should govern KPI credit?

## Confirmed operating/KPI rules
- Refunds should reverse previously recognized collected-KPI credit.
- Because refunds may happen long after the original collection month, the reversal should post as a negative collected event in the future period when the refund occurs, rather than silently rewriting prior-month history.
- Credit-card processor deposits may bundle multiple matters together.
- Those bundled deposits are manually transcribed into CosmoLex and reconciled later.
- The processor does **not** net the merchant fee out of each deposit.
- Merchant/card-processing fees are withdrawn separately, typically once monthly at the beginning of the month.

## Practical implications
- Deposit ingestion and KPI attribution cannot rely only on raw operating-bank deposits.
- We need invoice/payment-application detail from CosmoLex to break a bundled processor deposit into matter-level collected events.
- Monthly merchant-fee withdrawals should be modeled as separate expense events, not reductions of collected revenue deposits.
- `Invoice Payment Allocations` should be treated as the canonical recognition layer for operating-side attorney collected KPIs.
- Use `Applied Date` as the collected-KPI recognition date.
- Count only the `4100` portion of each applied payment toward attorney revenue KPIs.
- `Operating Retainer By Matter` should be used to model:
  - operating-retainer funding events
  - operating-retainer applications to invoices
  - negative/deficit retainer states that may need review

## Recommendation
After trust V1, the next drafting/implementation pass should focus on:
1. identifying the best operating-account reports
2. defining inclusion/exclusion rules for collected revenue
3. adding a manual reconciliation queue before attempting full automation
