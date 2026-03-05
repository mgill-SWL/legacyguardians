# Trust Accounting — Stage 1 Data Model (Legacy Guardians)

This is a pragmatic MVP data model for trust accounting that supports Virginia Rule 1.15-style requirements:

- Maintain **client/matter-level ledgers** (subsidiary ledgers)
- Prevent **negative balances** at the matter ledger level
- Support **receipts, disbursements, transfers, bank fees, earned-fee transfers (trust→operating), adjustments/voids**
- Support **monthly three-way reconciliation** (bank statement vs trust bank ledger vs sum of matter ledgers) with **maker/checker approval**
- Enable **integration push to CosmoLex** with strong idempotency + audit trail

> Terminology note: “matter” here is the unit of ownership for funds (client file). If your practice uses “client” instead, treat “matter” as the lowest-level ledger you must maintain to satisfy 1.15.

---

## Core accounting approach

Use a **ledger-entry** model:

- A **TrustTransaction** is the user/business event (e.g., receipt, disbursement).
- A transaction posts one or more **TrustLedgerEntries** (lines) that affect balances.
- Balances are derived from entries (optionally cached/snapshotted for performance).

For compliance and auditability:

- **Posted entries are immutable**.
- “Voids” and “corrections” are done via **reversing transactions** (and possibly a replacement transaction).

This keeps an audit trail and supports reconciliation.

---

## Entities / Tables

### 1) Client
Represents a person/entity the firm represents.

Key fields:
- `id` (UUID)
- `display_name`
- `external_refs` (JSON: IDs from other systems)
- `status` (active/inactive)
- `created_at`, `updated_at`

### 2) Matter
The smallest required ledger unit.

Key fields:
- `id` (UUID)
- `client_id` (FK)
- `matter_number` (string, unique within firm)
- `name`
- `office_id` (nullable FK; for future multi-location)
- `status` (open/closed)
- `opened_at`, `closed_at`

Invariants:
- Matter must exist to hold trust funds.
- Closing a matter requires **zero trust balance** (or explicit approved transfer out / escheat workflow later).

### 3) Office (future-facing but useful now)
Allows future multi-location accounting.

Key fields:
- `id`
- `name`
- `region` (optional)

### 4) TrustBankAccount
The real-world trust/IOLTA bank account.

Key fields:
- `id` (UUID)
- `office_id` (nullable)
- `bank_name`
- `account_last4`
- `routing_hash` (avoid storing routing in plaintext if possible)
- `currency` (USD)
- `status` (active/closed)

### 5) OperatingBankAccount (minimal for earned-fee transfers)
Where earned fees are deposited.

Key fields:
- `id`
- `office_id` (nullable)
- `bank_name`, `account_last4`
- `status`

### 6) TrustTransaction
Business event; source of truth for “what happened”.

Key fields:
- `id` (UUID)
- `trust_bank_account_id` (FK)
- `type` (enum):
  - `RECEIPT`
  - `DISBURSEMENT`
  - `TRANSFER_BETWEEN_MATTERS` (within same trust bank account)
  - `EARNED_FEE_TRANSFER` (trust→operating)
  - `BANK_FEE`
  - `ADJUSTMENT`
  - `VOID` (implemented as reversing; see below)
- `status` (enum): `DRAFT`, `PENDING_APPROVAL`, `POSTED`, `REJECTED`, `VOIDED`
- `effective_date` (date; when it impacts the ledger)
- `entered_at` (timestamp)
- `entered_by_user_id`
- `submitted_at`, `submitted_by_user_id` (nullable)
- `approved_at`, `approved_by_user_id` (nullable)
- `posted_at` (timestamp; set when ledger entries are created)
- `memo` (text)

External/bank fields (as applicable):
- `bank_txn_reference` (string; check #, bank trace, etc.)
- `payor_payee` (string)
- `method` (enum): `CHECK`, `ACH`, `WIRE`, `CASH`, `CARD`, `OTHER`

CosmoLex integration fields (local):
- `cosmolex_push_status` (enum): `NOT_READY`, `READY`, `PUSHING`, `PUSHED`, `FAILED`
- `cosmolex_push_block_reason` (text)

### 7) TrustLedgerEntry
The posted ledger lines. This is what reconciliation and balances are computed from.

Key fields:
- `id` (UUID)
- `trust_transaction_id` (FK)
- `trust_bank_account_id` (FK)
- `matter_id` (nullable FK)
  - **Required** for any entry that impacts a matter ledger.
  - Nullable for entries that are firm-level within trust (e.g., bank fee not attributable to a matter). Note: for strict 3-way reconciliation, firm-level trust entries should be minimized; prefer explicit matter allocation.
- `entry_type` (enum): `CREDIT` or `DEBIT`
- `amount_cents` (integer > 0)
- `currency` (USD)
- `effective_date` (date)
- `description`

Suggested indexes:
- `(trust_bank_account_id, effective_date)`
- `(matter_id, effective_date)`
- `(trust_transaction_id)`

Invariants:
- **No negative matter balance:** for each `(trust_bank_account_id, matter_id)`, running balance cannot drop below 0 at any point in posting order by `(effective_date, posted_at, id)`.
- Entries cannot be edited after posting; corrections are by reversal.

### 8) TrustMatterBalanceSnapshot (optional but recommended)
Denormalized current balance to quickly validate constraints + show UI balances.

Key fields:
- `trust_bank_account_id`
- `matter_id`
- `balance_cents`
- `as_of_posted_entry_id` (last entry included)
- `updated_at`

Invariants:
- Must equal sum of entries for the matter (or be recomputable via periodic verify job).

### 9) BankStatement
Represents an imported monthly bank statement (CSV/OFX/manual entry).

Key fields:
- `id`
- `trust_bank_account_id`
- `period_start` (date)
- `period_end` (date)
- `ending_balance_cents`
- `import_source` (enum): `MANUAL`, `CSV`, `OFX`, `PLAID` (future)
- `imported_at`, `imported_by_user_id`

### 10) BankStatementLine
Lines from the statement.

Key fields:
- `id`
- `bank_statement_id`
- `posted_date` (date)
- `description`
- `amount_cents` (signed or use `direction` + absolute amount)
- `direction` (enum `CREDIT`/`DEBIT`)
- `fit_id`/`bank_line_id` (unique if provided)

### 11) BankMatch
Maps internal trust transactions to statement lines.

Key fields:
- `id`
- `trust_transaction_id`
- `bank_statement_line_id`
- `matched_by_user_id`
- `matched_at`

Invariants:
- A statement line matches at most one posted transaction (or allow many-to-one if bank aggregates deposits; MVP can require one-to-one and allow manual “split deposit” later).

### 12) TrustReconciliation
Represents the monthly reconciliation package.

Key fields:
- `id`
- `trust_bank_account_id`
- `period_end` (date) — the statement ending date
- `bank_statement_id` (FK)
- `status` (enum): `OPEN`, `PENDING_APPROVAL`, `APPROVED`, `REOPENED`
- Maker/checker:
  - `prepared_by_user_id`, `prepared_at`
  - `approved_by_user_id`, `approved_at`
- Calculated totals:
  - `bank_ending_balance_cents`
  - `book_balance_cents` (trust bank ledger balance as-of period end)
  - `sum_of_matter_balances_cents`
  - `outstanding_deposits_cents`
  - `outstanding_checks_cents`
  - `variance_cents` (should be 0 to approve)

Invariants:
- Approval requires `variance_cents == 0` and maker != checker.

### 13) TrustReconciliationItem (optional)
Explicit list of outstanding deposits/checks as of statement date.

Key fields:
- `id`
- `trust_reconciliation_id`
- `trust_transaction_id`
- `type` (enum): `OUTSTANDING_DEPOSIT`, `OUTSTANDING_CHECK`
- `amount_cents`

### 14) CosmoLexPushAttempt
Outbox + retry tracking for pushing transactions to CosmoLex.

Key fields:
- `id`
- `trust_transaction_id`
- `idempotency_key` (string; see strategy below)
- `request_payload` (JSON)
- `response_status_code` (int, nullable)
- `response_body` (text/json, nullable)
- `status` (enum): `READY`, `IN_FLIGHT`, `SUCCEEDED`, `FAILED_RETRYABLE`, `FAILED_FATAL`
- `attempt_count`
- `next_attempt_at`
- `last_error`
- `cosmolex_object_id` (string, nullable)
- `created_at`, `updated_at`

Invariants:
- Unique constraint: `(trust_transaction_id)` or `(trust_transaction_id, idempotency_key)` depending on CosmoLex API behavior.

### 15) AuditLogEvent
Append-only audit log.

Key fields:
- `id`
- `occurred_at`
- `actor_user_id` (nullable for system)
- `event_type` (string)
- `entity_type` (string)
- `entity_id` (UUID/string)
- `before` (JSON, nullable)
- `after` (JSON, nullable)
- `metadata` (JSON)
- `request_id` / `trace_id` (optional)

---

## Posting logic and invariants (the compliance-critical bits)

### Invariant A — No negative matter balances
On posting any transaction with matter debits:

1. Compute impacted matters.
2. Validate that for each impacted `(trust_bank_account_id, matter_id)`: `current_balance_cents - debits + credits >= 0`.
3. Use a **serializable transaction** or **row-level locking** around `TrustMatterBalanceSnapshot` rows to prevent race conditions.

> If you can’t rely on snapshots, you must lock and re-sum entries for the matter (costly). MVP path: maintain snapshots.

### Invariant B — Entries are immutable after POSTED
- `TrustLedgerEntry` rows cannot be updated/deleted.
- Corrections:
  - Create a reversing `TrustTransaction` that posts equal/opposite entries.
  - Optionally create a replacement transaction.

### Invariant C — Three-way reconciliation must balance for approval
At reconciliation period end:

- **Bank statement ending balance**
  = **Book (trust bank ledger) balance**
  + outstanding deposits
  − outstanding checks

And:

- **Book balance** = sum over all matters + any non-matter trust entries (should be 0 or explicitly accounted)

Approval requires all to tie out (variance 0) and maker/checker separation.

---

## Earned-fee transfer modeling

Earned-fee transfer is a trust disbursement out of a matter to the operating account.

Represent as:

- `TrustTransaction(type=EARNED_FEE_TRANSFER)` posting:
  - **Debit** to the matter trust ledger (reduces client trust)
- Optionally reference an `Invoice`/`FeeEarnedRecord` entity (if billing exists). MVP: store `reference_type`/`reference_id` on the transaction.

Critical control:
- Must be approved (maker/checker) before posting.

---

## Bank fees modeling

For IOLTA/trust accounts, bank fees are generally firm responsibility and must not reduce any client’s funds.

MVP handling options:

1) **Firm-level trust entry** (`matter_id` null) plus requirement that firm maintains sufficient “firm funds in trust” (not ideal / often prohibited).
2) **Explicit matter allocation** (recommended): require selection of a matter (or a designated “Firm Trust Charges” matter) funded with firm money.

For MVP, implement option (2) with a dedicated firm-owned matter and require it never goes negative.

---

## Adjustment / write-off modeling

Adjustments should be rare and fully documented.

Model as `TrustTransaction(type=ADJUSTMENT)` with strict permissions and required reason code. Still posts ledger entries and must respect non-negative balances.

---

## CosmoLex push idempotency strategy

Goal: safely retry without duplicates.

### Idempotency keys
- Generate `idempotency_key = "lg_trust_txn:" + trust_transaction_id`.
- If CosmoLex supports an idempotency header or external reference field, include it.
- Otherwise, include in payload memo/reference and store mapping from `trust_transaction_id → cosmolex_object_id`.

### Outbox pattern
- Only enqueue a `CosmoLexPushAttempt` when the transaction is **POSTED**.
- Worker sends payload; on success, mark attempt `SUCCEEDED` and store `cosmolex_object_id`.
- Retries:
  - Retryable failures (5xx, timeouts, rate limits) backoff.
  - Fatal failures (4xx validation) require human intervention; set transaction `cosmolex_push_status=FAILED`.

### De-duplication
- Enforce unique constraint on `CosmoLexPushAttempt(trust_transaction_id)`.
- On retry, reuse the same `idempotency_key`.

---

## Audit logging — required events (Stage 1)

Log these events as `AuditLogEvent` (append-only):

- `trust.transaction.created`
- `trust.transaction.updated` (draft-only; include before/after)
- `trust.transaction.submitted_for_approval`
- `trust.transaction.approved`
- `trust.transaction.rejected`
- `trust.transaction.posted` (include entries summary)
- `trust.transaction.void_requested`
- `trust.transaction.void_posted` (reversal transaction id)
- `trust.transaction.cosmolex.push.enqueued`
- `trust.transaction.cosmolex.push.attempted`
- `trust.transaction.cosmolex.push.succeeded`
- `trust.transaction.cosmolex.push.failed`

- `trust.reconciliation.created`
- `trust.reconciliation.updated`
- `trust.reconciliation.submitted_for_approval`
- `trust.reconciliation.approved`
- `trust.reconciliation.reopened`

- `trust.bank_statement.imported`
- `trust.bank_match.created`
- `trust.bank_match.deleted`

- `trust.permissions.role_assigned` / `trust.permissions.role_revoked`

Include `actor_user_id`, timestamps, and request metadata for every event.
