# Prisma Transaction Inbox Model Draft (v1)

This draft extends the bookkeeping architecture so Legacy Guardians can ingest raw bank/card transactions, route them through a review queue, and normalize them into bookkeeping/KPI events.

## Core principle
Legacy Guardians should own:
- raw transaction ingestion
- categorization decisions
- matter/invoice linkage
- normalization into financial events

CosmoLex becomes a supporting system, not the source of truth.

---

## Proposed Prisma enums

```prisma
enum FinancialFeedSource {
  BANK_CSV
  CARD_CSV
  MANUAL
  COSMOLEX
  OTHER
}

enum FinancialAccountKind {
  OPERATING_BANK
  TRUST_BANK
  MONEY_MARKET
  CREDIT_CARD
  LIABILITY
  CLEARING
  OTHER
}

enum RawTransactionDirection {
  INFLOW
  OUTFLOW
}

enum TransactionReviewStatus {
  UNREVIEWED
  NEEDS_INFO
  MATCHED
  IGNORED
}

enum FinancialClassificationType {
  TRUST_DEPOSIT
  TRUST_TO_OPERATING_TRANSFER
  TRUST_MATTER_TRANSFER
  OPERATING_RETAINER_DEPOSIT
  OPERATING_RETAINER_APPLICATION
  DIRECT_FEE_PAYMENT
  REIMBURSED_COST_PAYMENT
  REFUND
  MERCHANT_FEE
  OWNER_TRANSFER
  EXPENSE
  IGNORE
}
```

---

## New models

### FinancialAccount
Represents a real-world account/feed source.

```prisma
model FinancialAccount {
  id        String @id @default(cuid())
  firmId    String
  firm      Firm   @relation(fields: [firmId], references: [id], onDelete: Cascade)

  name      String
  kind      FinancialAccountKind

  institutionName String?
  last4           String?
  externalId      String?
  active          Boolean @default(true)

  rawTransactions RawFinancialTransaction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([firmId, name])
  @@index([firmId, kind, active])
}
```

### FinancialImportBatch
Tracks one uploaded CSV/feed batch.

```prisma
model FinancialImportBatch {
  id        String @id @default(cuid())
  firmId    String
  firm      Firm   @relation(fields: [firmId], references: [id], onDelete: Cascade)

  source        FinancialFeedSource
  accountId     String?
  account       FinancialAccount? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  sourceFilename String?
  sourceFileUrl  String?
  importedByUserId String?
  importedByUser   User? @relation(fields: [importedByUserId], references: [id], onDelete: SetNull)

  rawTransactions RawFinancialTransaction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([firmId, source, createdAt])
}
```

### RawFinancialTransaction
Immutable imported row from a bank/card feed.

```prisma
model RawFinancialTransaction {
  id        String @id @default(cuid())
  firmId    String
  firm      Firm   @relation(fields: [firmId], references: [id], onDelete: Cascade)

  accountId String?
  account   FinancialAccount? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  importBatchId String?
  importBatch   FinancialImportBatch? @relation(fields: [importBatchId], references: [id], onDelete: SetNull)

  source        FinancialFeedSource
  transactionDate DateTime
  postedDate      DateTime?

  amountCents Int
  direction   RawTransactionDirection

  payee       String?
  description String
  memo        String?
  externalReference String?

  rawData     Json
  dedupeHash  String

  reviewItems TransactionReviewItem[]
  classifications FinancialClassification[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([firmId, dedupeHash])
  @@index([firmId, transactionDate])
  @@index([accountId, transactionDate])
  @@index([importBatchId])
}
```

### TransactionReviewItem
Human review workflow record.

```prisma
model TransactionReviewItem {
  id        String @id @default(cuid())

  rawTransactionId String
  rawTransaction   RawFinancialTransaction @relation(fields: [rawTransactionId], references: [id], onDelete: Cascade)

  status      TransactionReviewStatus @default(UNREVIEWED)
  suggestedCategory FinancialClassificationType?
  reviewNotes String?

  reviewedByUserId String?
  reviewedByUser   User? @relation(fields: [reviewedByUserId], references: [id], onDelete: SetNull)
  reviewedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, createdAt])
  @@index([rawTransactionId])
}
```

### FinancialClassification
Business meaning attached to a raw transaction.

```prisma
model FinancialClassification {
  id        String @id @default(cuid())

  rawTransactionId String
  rawTransaction   RawFinancialTransaction @relation(fields: [rawTransactionId], references: [id], onDelete: Cascade)

  classificationType FinancialClassificationType

  effectiveDate DateTime
  amountCents   Int

  matterId String?
  matter   Matter? @relation(fields: [matterId], references: [id], onDelete: SetNull)

  contactId String?
  contact   Contact? @relation(fields: [contactId], references: [id], onDelete: SetNull)

  invoiceNumber String?
  notes         String?
  confidence    Int?

  createdByUserId String?
  createdByUser   User? @relation(fields: [createdByUserId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([classificationType, effectiveDate])
  @@index([matterId])
  @@index([invoiceNumber])
  @@index([rawTransactionId])
}
```

---

## Relationship to MatterFinancialEvent
After review/classification:
- a `FinancialClassification` may generate one or more `MatterFinancialEvent` rows
- or may directly map to one `MatterFinancialEvent`

Examples:
- trust deposit CSV row -> raw transaction -> `TRUST_DEPOSIT` classification -> `MatterFinancialEvent`
- Chase charge -> raw transaction -> `EXPENSE` classification -> later accounting event
- operating bank deposit -> raw transaction -> `DIRECT_FEE_PAYMENT` or `OPERATING_RETAINER_DEPOSIT`

## Recommended workflow
1. import bank/card CSV into `RawFinancialTransaction`
2. create `TransactionReviewItem`
3. user categorizes/linkages in inbox UI
4. create `FinancialClassification`
5. generate normalized `MatterFinancialEvent`
6. compute KPIs from normalized events

## Why this is the right next foundation
- supports bank-first bookkeeping
- preserves immutable source rows
- allows manual review for ambiguous transactions
- supports multiple institutions/accounts
- keeps KPI logic downstream of normalized events, not raw CSVs

## Immediate next implementation slice
1. add these Prisma enums/models
2. create first CSV importer for one real bank account
3. build `/management/accounting/inbox`
4. support manual review + classification
5. map approved classifications into `MatterFinancialEvent`
