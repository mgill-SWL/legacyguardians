# Bank-Feed / Transaction Inbox Architecture (v1)

## Core decision
Legacy Guardians, not CosmoLex, should become the **source of truth** for bookkeeping classification and KPI-driving financial events.

CosmoLex should become:
- a historical backfill source
- an optional reconciliation source
- a temporary bridge during migration

## Primary bookkeeping backbone

### Source of truth inside LG
The LG database should own:
- imported bank/card transactions
- manual categorization decisions
- matter/client/invoice links
- bookkeeping event normalization
- KPI attribution logic

### Input sources
V1 input sources:
- Burke & Herbert operating account CSV
- Burke & Herbert trust account CSV
- South State money market CSV
- Chase credit card CSV
- manual entry in app
- optional CosmoLex imports for reconciliation and invoice-allocation support

V2+ possible sources:
- direct bank feeds
- Stripe / payment processor integrations
- direct check-print/payment data

## Recommended flow

1. import raw financial feed rows
2. place them in a transaction inbox
3. categorize/classify in-app
4. link to matter/client/invoice
5. normalize into bookkeeping events
6. compute KPIs from normalized events
7. optionally reconcile against Cosmolex

## New conceptual layers

### 1. RawFinancialTransaction
Immutable imported bank/card row.

Fields:
- `id`
- `firmId`
- `accountId`
- `sourceSystem` (`BANK_CSV`, `CARD_CSV`, `MANUAL`, `COSMOLEX`, etc.)
- `sourceFileId` / import batch id
- `transactionDate`
- `postedDate` nullable
- `description`
- `memo` nullable
- `payee`
- `amountCents`
- `direction` (`INFLOW`, `OUTFLOW`)
- `externalReference` nullable
- `rawData` JSON
- `dedupeHash`
- `createdAt`

Purpose:
- preserve raw source facts exactly as imported
- never mutate the original meaning of the transaction row

### 2. TransactionReviewItem
Human workflow layer.

Fields:
- `id`
- `rawTransactionId`
- `status` (`UNREVIEWED`, `NEEDS_INFO`, `MATCHED`, `IGNORED`)
- `suggestedCategory`
- `reviewNotes`
- `reviewedByUserId` nullable
- `reviewedAt` nullable

Purpose:
- support transaction inbox review
- allow manual categorization before normalization

### 3. FinancialClassification
Normalized business meaning assigned to a raw transaction.

Fields:
- `id`
- `rawTransactionId`
- `classificationType`
- `confidence` nullable
- `matterId` nullable
- `invoiceNumber` nullable
- `contactId` nullable
- `userAttributionId` nullable
- `effectiveDate`
- `amountCents`
- `notes`

Examples of `classificationType`:
- `TRUST_DEPOSIT`
- `TRUST_TO_OPERATING_TRANSFER`
- `OPERATING_RETAINER_DEPOSIT`
- `OPERATING_RETAINER_APPLICATION`
- `DIRECT_FEE_PAYMENT`
- `REFUND`
- `MERCHANT_FEE`
- `REIMBURSED_COST_PAYMENT`
- `OWNER_TRANSFER`
- `EXPENSE`
- `IGNORE`

### 4. MatterFinancialEvent
This still remains the normalized event layer for KPI/accounting logic.

Difference now:
- it can be created from **raw bank/card transactions**
- not only from Cosmolex reports

## Why this is better than report-only imports
- lets LG own real bookkeeping decisions
- supports manual review where needed
- supports multiple financial institutions
- makes bank feed / CSV import the primary workflow
- makes Cosmolex optional rather than central

## V1 user experience

### Admin bookkeeping inbox
Suggested page:
- `/management/accounting/inbox`

Functions:
- upload bank CSV
- upload card CSV
- see uncategorized transactions
- assign category
- link matter/client/invoice
- flag for later review
- approve normalized event creation

### Reconciliation views
Suggested pages:
- `/management/accounting/reconciliation`
- `/management/accounting/transfers`
- `/management/accounting/retainers`

## V1 rule of thumb for source hierarchy
1. **Bank/card CSVs** = primary source of raw money movement
2. **Manual review in LG** = primary source of business meaning
3. **CosmoLex reports** = reconciliation and invoice-allocation helper
4. **Google Sheets** = downstream reporting only

## Special cases already identified
- trust to operating transfers count as collected KPI events
- only `4100 Fee Income` counts toward attorney collected revenue
- `4200` and `4250` are excluded from attorney revenue KPIs
- bundled processor deposits require allocation support
- operating retainer is a liability ledger, not direct revenue
- refunds reverse KPI credit in the period they occur
- monthly merchant fee withdrawals should be separate expense events
- matter-to-matter transfers must exist but do not count as collected revenue

## V1 recommended implementation sequence
1. model raw bank/card transaction tables
2. build importers for Burke & Herbert / Chase CSVs
3. build transaction inbox UI
4. build classification workflow
5. create normalized financial events from approved classifications
6. keep Cosmolex invoice-payment allocations as a supporting import for invoice-level decomposition
7. compute KPIs from normalized events

## Immediate next design task
Design the Prisma models for:
- raw transaction ingestion
- review queue
- classification/normalization pipeline
