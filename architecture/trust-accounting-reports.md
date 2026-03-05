# Trust Accounting — Stage 1 Reports

These reports are the minimum set to operate and evidence compliance (including Virginia Rule 1.15-style controls). Where possible, include:

- Trust bank account
- Reporting period (from/to)
- Prepared by / prepared at
- Approved by / approved at (for monthly reconciliation package)

All reports should be exportable to PDF/CSV.

---

## 1) Matter (Client) Trust Ledger
Purpose: subsidiary ledger for a single matter.

Filters:
- Trust bank account
- Matter
- Date range

Required fields per line:
- Effective date
- Transaction ID
- Transaction type
- Payor/Payee
- Reference (check # / trace)
- Description/memo
- Debit amount
- Credit amount
- Running balance (must never go negative)

Header/footer fields:
- Opening balance
- Closing balance

---

## 2) Trust Bank Ledger (Cashbook)
Purpose: book ledger for the trust bank account.

Filters:
- Trust bank account
- Date range

Required fields per line:
- Effective date
- Transaction ID
- Type
- Payor/Payee
- Reference
- Total debit
- Total credit

Totals:
- Opening book balance
- Closing book balance

Note:
- If the system models only matter-level entries (recommended), bank ledger totals can be derived by summing all matter entries for the account.

---

## 3) Trust Trial Balance / Matter Balance Listing (as-of)
Purpose: show each matter’s ending balance; sum is used for three-way reconciliation.

Filters:
- Trust bank account
- As-of date

Required fields:
- Matter number
- Matter name
- Client name
- Balance as-of

Totals:
- Sum of all matter balances

---

## 4) Deposits Register
Purpose: list all receipts for period; helps identify outstanding deposits.

Filters:
- Trust bank account
- Date range

Required fields:
- Effective date
- Deposit source/payor
- Matter allocations (matter + amount)
- Total deposit amount
- Bank reference (if known)
- Posted date/time

---

## 5) Disbursements / Checks Register
Purpose: list all disbursements; helps identify outstanding checks.

Filters:
- Trust bank account
- Date range

Required fields:
- Effective date
- Payee
- Method
- Check number / trace
- Matter allocations
- Total disbursement amount
- Cleared status (matched to statement line: yes/no)

---

## 6) Outstanding Deposits Report (as-of statement end)
Purpose: deposits recorded in books but not yet on bank statement.

Filters:
- Trust bank account
- Statement period end date

Required fields:
- Transaction ID
- Effective date
- Amount
- Matter allocations
- Age (days outstanding)

---

## 7) Outstanding Checks Report (as-of statement end)
Purpose: disbursements not cleared on bank statement.

Filters:
- Trust bank account
- Statement period end date

Required fields:
- Transaction ID
- Effective date
- Check #/trace
- Payee
- Amount
- Matter allocations
- Age (days outstanding)

---

## 8) Three-Way Reconciliation Summary (monthly)
Purpose: the compliance-critical monthly package.

Filters:
- Trust bank account
- Statement (period end)

Required fields:
- Bank statement ending balance
- Plus outstanding deposits
- Minus outstanding checks
- Equals adjusted bank balance

- Book (trust bank ledger) ending balance
- Variance: adjusted bank balance − book balance

- Sum of matter balances as-of period end
- Variance: book balance − sum of matter balances

Approval block:
- Prepared by / prepared at
- Approved by / approved at
- Assertion: variances are 0

Supporting attachments (recommended):
- imported statement (or reference)
- outstanding items lists
- matter balance listing

---

## 9) Voids / Reversals Log
Purpose: identify all voided transactions and their reversals.

Filters:
- Date range

Required fields:
- Original transaction id/type/date/amount
- Reversal transaction id/date
- Who requested void
- Who approved void
- Reason

---

## 10) CosmoLex Sync Status Report
Purpose: operational monitoring for integration.

Filters:
- Date range
- Status (pushed/failed/pending)

Required fields:
- Trust transaction id
- Type
- Posted at
- Push status
- Last attempt at
- Attempt count
- Error summary
- CosmoLex object id (if pushed)
