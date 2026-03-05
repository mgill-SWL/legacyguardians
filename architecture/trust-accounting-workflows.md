# Trust Accounting — Stage 1 Workflows (User Flows + State Machines)

This document defines MVP workflows that satisfy trust accounting controls:

- Matter-level ledgers, no negative balances
- Receipts, disbursements, transfers, bank fees, earned-fee transfers, adjustments/voids
- Monthly three-way reconciliation with maker/checker approval
- CosmoLex push (outbox + idempotency)

---

## Common concepts

### Transaction lifecycle (state machine)
Applies to all trust transactions.

States:

- `DRAFT`
- `PENDING_APPROVAL`
- `POSTED`
- `REJECTED`
- `VOIDED` (note: implemented by posting a reversal; original remains POSTED but is marked voided)

Transitions:

1. Create → `DRAFT`
2. Submit for approval → `PENDING_APPROVAL`
3. Approve → `POSTED` (posting creates immutable ledger entries)
4. Reject → `REJECTED` (can return to draft with edits, or create a new draft)
5. Void request/approve → create reversal transaction → original marked `VOIDED`

Rules:
- Only `DRAFT` can be edited.
- Posting is a single atomic operation:
  - validate balances (no-negative)
  - create ledger entries
  - update snapshots
  - mark as posted
  - enqueue CosmoLex push attempt

### Maker / Checker rules
- Maker = the user who submits/creates.
- Checker = approving attorney/owner (today) or Central Finance Approver (future).

Constraints:
- Maker and checker must be different users.
- Certain transaction types require approval (at minimum: disbursements, transfers between matters, earned-fee transfers, adjustments, voids). Deposits may be allowed to post without approval in some firms, but for MVP keep it consistent: **everything posts via approval**.

### No-negative balance enforcement
On approval/post:

- For each impacted matter, ensure `balance - debits + credits >= 0`.
- Enforce with locks on per-matter snapshot rows.

---

## Workflow: Record a receipt (deposit)

Use case: client gives retainer; settlement deposit; etc.

Inputs:
- Trust bank account
- Matter
- Amount
- Effective date
- Payor, method, reference
- Memo

Steps:
1. Maker creates receipt transaction (`DRAFT`).
2. System shows current matter balance and projected balance after receipt.
3. Maker submits for approval (`PENDING_APPROVAL`).
4. Checker approves:
   - Post a `CREDIT` ledger entry to the matter.
   - Update matter snapshot.
   - Mark `POSTED`.
   - Enqueue CosmoLex push.

Edge cases:
- Split deposit across multiple matters: MVP can allow multiple ledger entries under one receipt transaction.

---

## Workflow: Disbursement (check/ACH/wire out of trust)

Use case: pay third party from client trust.

Inputs:
- Trust bank account
- One or more matters + amounts (support split checks if needed)
- Payee
- Method + check number (if applicable)
- Effective date

Steps:
1. Maker creates disbursement (`DRAFT`) selecting matter(s) and amounts.
2. System validates at creation time (soft): projected balances not negative.
3. Maker submits for approval.
4. Checker approves:
   - Hard validate no-negative balances (locked).
   - Post `DEBIT` entries for each matter allocation.
   - Update snapshots.
   - Mark `POSTED`.
   - Enqueue CosmoLex push.

Operational controls (MVP):
- Require payee + method for disbursement.
- Require supporting note/attachment optional but recommended.

---

## Workflow: Transfer between matters (within same trust account)

Use case: moving funds between related matters for same client (or as authorized).

Inputs:
- From matter
- To matter
- Amount
- Effective date
- Reason

Steps:
1. Maker creates transfer (`DRAFT`).
2. System checks projected balances.
3. Maker submits for approval.
4. Checker approves:
   - Validate from-matter balance sufficient.
   - Post two entries:
     - `DEBIT` from `from_matter`
     - `CREDIT` to `to_matter`
   - Update both snapshots.
   - Mark `POSTED`.
   - Enqueue CosmoLex push.

Constraints:
- Same trust bank account.
- Amount > 0.

---

## Workflow: Earned-fee transfer (trust → operating)

Use case: fees earned; move funds to operating.

Inputs:
- Matter
- Amount
- Effective date
- (Optional) invoice reference
- Operating bank account (destination)

Steps:
1. Maker creates earned-fee transfer (`DRAFT`).
2. System requires an “earned basis” reason and (if available) invoice selection.
3. Maker submits for approval.
4. Checker approves:
   - Validate matter balance sufficient.
   - Post `DEBIT` entry to the matter.
   - Mark `POSTED`.
   - Enqueue CosmoLex push (often critical).

Notes:
- In full systems, the operating-side entry would be recorded in general ledger. MVP scope: track the trust-side reduction and include destination account info for audit.

---

## Workflow: Bank fee

Use case: monthly service fee, wire fee.

MVP recommended handling: fees are charged to a **firm-owned matter** (e.g., “Firm: Trust Charges”) that is funded by explicit firm deposits.

Steps:
1. Maker creates bank fee transaction (`DRAFT`): selects the firm-owned matter.
2. Maker submits for approval.
3. Checker approves:
   - Validate firm-owned matter balance sufficient.
   - Post `DEBIT` entry to that matter.
   - Mark `POSTED`.
   - Enqueue CosmoLex push if required (optional; depends whether CosmoLex tracks fees).

---

## Workflow: Void / reverse a posted transaction

Use case: check lost; wrong matter used; incorrect amount.

Principle: **Never delete posted items.** Void by reversal.

Steps:
1. Maker requests void on a `POSTED` transaction (creates a `VOID` draft referencing original).
2. Maker submits void for approval.
3. Checker approves void:
   - System creates a reversal transaction that posts equal/opposite entries with same effective date (or void date, depending policy).
   - System marks original transaction as `VOIDED` and links it to reversal.
   - Enqueue CosmoLex push for reversal as needed.

Constraints:
- Reversal must not cause negative balances (it usually won’t, because it adds back debits / removes credits, but reversal of a receipt could create negatives if funds already spent—this is a real-world problem and should hard-fail until resolved).

---

## Workflow: Adjustment

Use case: rare corrections when no other workflow fits.

Controls:
- Require special permission.
- Require reason code + long-form memo.
- Always maker/checker.

Steps:
1. Maker creates adjustment (`DRAFT`) selecting matters and debit/credit directions explicitly.
2. Submit for approval.
3. Checker approves:
   - Validate no negative balances.
   - Post entries.

---

## Monthly three-way reconciliation workflow

Objective: reconcile as-of bank statement end date.

Inputs:
- Bank statement (import lines)
- Internal posted transactions up to period end
- Matching between statement lines and internal transactions

Steps:
1. Maker imports/creates `BankStatement` for the trust bank account (period start/end, ending balance, statement lines).
2. Maker performs matching:
   - Match statement lines to posted trust transactions.
   - Identify outstanding deposits (internal deposits not on statement).
   - Identify outstanding checks (internal disbursements not cleared on statement).
3. System computes:
   - Bank ending balance (from statement)
   - Book balance (sum of ledger entries as of period end)
   - Sum of matter balances (sum snapshots as-of period end, or recomputed)
   - Outstanding totals
   - Variance
4. Maker reviews variance and resolves discrepancies.
5. Maker submits reconciliation for approval (`PENDING_APPROVAL`).
6. Checker approves only if:
   - variance = 0
   - maker != checker
   - reconciliation package complete (required reports attached/exported)

Artifacts to store (MVP):
- reconciliation summary fields (totals)
- list of outstanding items
- who prepared and who approved
- snapshot of the three-way report (PDF or stored JSON)

Reopen flow:
- Only checker (or admin) can reopen an approved reconciliation.
- Reopening must be audited and requires reason.

---

## CosmoLex push workflow (outbox)

Trigger:
- When a trust transaction becomes `POSTED`.

Steps:
1. System enqueues `CosmoLexPushAttempt(status=READY, idempotency_key=lg_trust_txn:<id>)`.
2. Worker picks up READY attempts:
   - sets status `IN_FLIGHT`
   - sends payload to CosmoLex
3. On success:
   - store `cosmolex_object_id`
   - mark attempt `SUCCEEDED`
   - mark transaction `PUSHED`
4. On retryable failure:
   - mark `FAILED_RETRYABLE`, set `next_attempt_at`
5. On fatal failure:
   - mark `FAILED_FATAL`
   - transaction push status `FAILED`
   - surface to human for correction

Idempotency:
- Retries reuse same idempotency key.
- If CosmoLex returns “already exists” for same reference, treat as success and store the object id if available.
