# Prisma KPI / Financial Model Draft (v1)

This is the proposed **database-first** layer for moving Legacy Guardians from:
- uploaded reports + spreadsheet KPIs

to:
- matter-linked financial events
- attribution
- import batches
- DB-computed KPIs

## Design goals
- fit the existing `Firm`, `User`, and `Matter` models
- preserve import lineage from CosmoLex
- support both trust and operating money movement
- support split attribution across multiple timekeepers
- keep Google Sheets as a downstream output only

---

## Proposed Prisma enums

```prisma
enum FinancialSourceSystem {
  COSMOLEX
  MANUAL
  IMPORT
  OTHER
}

enum BillingAccountType {
  TRUST
  OPERATING
  ACCOUNTS_RECEIVABLE
  REVENUE
  EXPENSE
  OTHER
}

enum MatterFinancialEventType {
  BILLED
  PAYMENT_RECEIVED
  TRUST_DEPOSIT
  TRUST_APPLIED
  OPERATING_DEPOSIT
  REFUND
  WRITE_OFF
  TRANSFER
}

enum FinancialAttributionRole {
  LEAD_ATTORNEY
  TIMEKEEPER
  INTAKE_OWNER
  ORIGINATOR
  OTHER
}

enum KpiImportReportType {
  COLLECTIONS_BY_TIMEKEEPER
  BILLINGS_BY_TIMEKEEPER
}

enum KpiImportBatchStatus {
  PENDING
  IMPORTED
  FAILED
}
```

---

## New models

### BillingAccount
```prisma
model BillingAccount {
  id        String @id @default(cuid())
  firmId    String
  firm      Firm   @relation(fields: [firmId], references: [id], onDelete: Cascade)

  name      String
  accountType BillingAccountType

  sourceSystem FinancialSourceSystem @default(MANUAL)
  externalId   String?
  active       Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  financialEventsFrom MatterFinancialEvent[] @relation("FinancialEventFromAccount")
  financialEventsTo   MatterFinancialEvent[] @relation("FinancialEventToAccount")

  @@unique([firmId, name])
  @@index([firmId, accountType, active])
}
```

### KpiImportBatch
```prisma
model KpiImportBatch {
  id        String @id @default(cuid())
  firmId    String
  firm      Firm   @relation(fields: [firmId], references: [id], onDelete: Cascade)

  sourceSystem FinancialSourceSystem @default(COSMOLEX)
  reportType   KpiImportReportType
  status       KpiImportBatchStatus @default(PENDING)

  rangeStart DateTime?
  rangeEnd   DateTime?

  sourceFilename String?
  sourceFileUrl  String?
  errorMessage   String?

  uploadedByUserId String?
  uploadedByUser   User? @relation(fields: [uploadedByUserId], references: [id], onDelete: SetNull)

  financialEvents MatterFinancialEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([firmId, reportType, createdAt])
  @@index([status])
}
```

### MatterFinancialEvent
```prisma
model MatterFinancialEvent {
  id        String @id @default(cuid())
  firmId    String
  firm      Firm   @relation(fields: [firmId], references: [id], onDelete: Cascade)

  matterId  String?
  matter    Matter? @relation(fields: [matterId], references: [id], onDelete: SetNull)

  eventType MatterFinancialEventType
  eventDate DateTime

  amountCents Int
  currency    String @default("USD")

  sourceSystem FinancialSourceSystem @default(IMPORT)
  sourceReference String?
  sourceInvoiceNumber String?
  sourceMatterFileNumber String?
  sourceClientName String?
  sourceMatterName String?
  notes        String?

  fromAccountId String?
  fromAccount   BillingAccount? @relation("FinancialEventFromAccount", fields: [fromAccountId], references: [id], onDelete: SetNull)

  toAccountId String?
  toAccount   BillingAccount? @relation("FinancialEventToAccount", fields: [toAccountId], references: [id], onDelete: SetNull)

  importBatchId String?
  importBatch   KpiImportBatch? @relation(fields: [importBatchId], references: [id], onDelete: SetNull)

  createdByUserId String?
  createdByUser   User? @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)

  attributions MatterFinancialAttribution[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([firmId, eventType, eventDate])
  @@index([matterId, eventDate])
  @@index([importBatchId])
  @@index([sourceInvoiceNumber])
}
```

### MatterFinancialAttribution
```prisma
model MatterFinancialAttribution {
  id        String @id @default(cuid())

  financialEventId String
  financialEvent   MatterFinancialEvent @relation(fields: [financialEventId], references: [id], onDelete: Cascade)

  userId      String?
  user        User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  displayName String
  role        FinancialAttributionRole @default(TIMEKEEPER)

  amountCents   Int
  percentageBps Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([financialEventId])
  @@index([userId])
  @@index([displayName])
}
```

---

## Minimal additions to existing models

### User
```prisma
model User {
  // existing fields...

  cosmolexTimekeeperName String?

  createdFinancialEvents MatterFinancialEvent[] @relation("MatterFinancialEvent_createdByUser")
  financialAttributions  MatterFinancialAttribution[]
  uploadedKpiImportBatches KpiImportBatch[]
}
```

### Matter
```prisma
model Matter {
  // existing fields...

  financialEvents MatterFinancialEvent[]
}
```

### Firm
```prisma
model Firm {
  // existing fields...

  billingAccounts BillingAccount[]
  kpiImportBatches KpiImportBatch[]
  financialEvents MatterFinancialEvent[]
}
```

---

## Practical mapping from current CosmoLex uploads

### Collections by Timekeeper
For each row:
- create `KpiImportBatch` for the uploaded report
- create `MatterFinancialEvent`
  - `eventType = PAYMENT_RECEIVED`
  - `eventDate = payment date`
  - `amountCents = collected fee`
  - `sourceInvoiceNumber = invoice #`
  - `sourceClientName = client`
  - `sourceMatterName = matter`
- create `MatterFinancialAttribution`
  - `role = TIMEKEEPER`
  - `displayName = timekeeper`
  - `amountCents = collected fee`

Important note:
- this report is still useful for cross-checking timekeeper-level collections
- but it is no longer the preferred primary source for final operating-side KPI recognition if `Invoice Payment Allocations` is available

### Billings by Timekeeper
For each row:
- create `MatterFinancialEvent`
  - `eventType = BILLED`
  - `eventDate = invoice date`
  - `amountCents = billed fee`
- create `MatterFinancialAttribution`
  - `role = TIMEKEEPER`
  - `displayName = timekeeper`
  - `amountCents = billed fee`

### Trust Receipts Journal
For each row:
- create `MatterFinancialEvent`
  - `eventType = TRUST_DEPOSIT`
  - `eventDate = receipt date`
  - `amountCents = trust receipt amount`
  - `toAccount = trust account`
  - preserve `Received From`, `Method`, and `Purpose of Funds`
- this represents money entering trust, not yet necessarily collected revenue

### Trust Disbursements Journal
For each row:
- if `Paid To = Speedwell Law` and purpose indicates `Trust to General Transfer`:
  - create `MatterFinancialEvent`
    - `eventType = TRANSFER`
    - `eventDate = disbursement date`
    - `amountCents = transfer amount`
    - `fromAccount = trust account`
    - `toAccount = operating/general account` when modeled
  - business interpretation: count this as **collected** for KPI purposes
- otherwise, treat as trust outflow and classify further as needed

### Trust Transfer Record
For matter-to-matter trust transfers:
- create `MatterFinancialEvent`
  - `eventType = TRANSFER`
- this is a required trust-accounting capability even if infrequent
- this should **not** count as collected revenue

### Operating Retainer By Matter
Treat this as a **liability-ledger source**.

Use it to model:
- operating-retainer funding events
- operating-retainer applications to invoices
- negative operating-retainer balances / deficit states

Interpretation rules:
- a positive increase reflects funding of operating retainer liability
- a negative application tied to an invoice reflects application/drawdown of operating retainer
- this report is useful for lifecycle/reconciliation of `2320: Client General Retainer (Operating)`
- this report alone should not be treated as the canonical attorney KPI recognition source
- negative ending balances likely indicate retainer over-application at the liability-ledger level and should be reviewable

### Invoice Payment Allocations
This should be treated as the preferred source for **collected KPI recognition** when available.

Use it to create one or more recognition rows per applied payment:
- recognition date = `Applied Date`
- preserve:
  - `Matter Owner`
  - `Inv #`
  - `Inv Date`
  - `Client-Matter`
  - source classification from the transaction summary (`From Trust`, `New Payment`, `Operating Retainer`)
  - account-level decomposition from the detail/account summary sheets

Interpretation rules:
- only the `4100: Fee Income` portion counts toward attorney collected-revenue KPIs
- `4200` and `4250` should be stored/tracked but excluded from attorney revenue KPIs
- `From Trust` means the collected event was recognized via trust funds
- `New Payment` means the collected event came from a direct payment
- `Operating Retainer` means the collected event came from previously held operating retainer funds

Practical result:
- bundled processor deposits can be ignored for KPI attribution if CosmoLex later allocates them correctly at the invoice-payment level
- `Invoice Payment Allocations` becomes the canonical KPI-recognition layer, while bank and ledger reports become reconciliation/supporting sources

---

## KPI interpretation rules layered on top of bookkeeping events
- `BILLED` contributes to billed KPIs.
- `PAYMENT_RECEIVED` contributes to collected KPIs when it resolves to **fee income**, not reimbursed-cost income.
- `REFUND` should reverse collected KPI credit in the period when the refund occurs; do not silently rewrite prior-period KPI history.
- `TRANSFER` from **trust -> operating/general** also contributes to collected KPIs.
- direct operating-retainer receipts exist and may bypass trust, but should only count toward attorney collected KPIs when earned into `4100:Fee Income`.
- `TRANSFER` from **matter -> matter** does **not** contribute to collected KPIs.
- `TRUST_DEPOSIT` reflects money received into trust but does not itself equal collected revenue.
- `4200` and `4250` reimbursed-cost income should be tracked separately and excluded from attorney collected-revenue KPIs.

---

## Why this schema is the right next step
- It keeps imported Cosmolex data attached to real `Matter` records.
- It supports trust/operating tracking later without redesign.
- It supports one event splitting across multiple people.
- It makes KPI queries straightforward and auditable.
- It leaves room to ingest from bookkeeping tools later.
- It supports bundled operating deposits being decomposed later into invoice/matter-level collected events.

---

## Suggested implementation order
1. Add these Prisma enums/models.
2. Add nullable `User.cosmolexTimekeeperName`.
3. Generate migration.
4. Build `POST /admin/imports/cosmolex` flow.
5. Match imported rows to matters.
6. Compute KPI snapshot queries from `MatterFinancialEvent` + `MatterFinancialAttribution`.
7. Then wire dashboard + Sheets sync.
