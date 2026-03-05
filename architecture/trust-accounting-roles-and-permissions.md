# Trust Accounting — Stage 1 Roles & Permissions (SoD)

Goal: enforce separation of duties (maker/checker) and limit high-risk actions.

This is a pragmatic MVP RBAC model. Implement as roles + permissions, with per-office scoping in the future.

---

## Roles (MVP)

### 1) Trust Clerk (Maker)
Typical: legal assistant/bookkeeper entering transactions.

Can:
- Create/edit `DRAFT` trust transactions
- Submit transactions for approval
- Import bank statements
- Perform statement matching
- Prepare a reconciliation package and submit for approval
- View reports

Cannot:
- Approve/post trust transactions
- Approve reconciliation
- Create adjustments (unless explicitly granted)
- Void posted transactions (can request void, but not approve)

### 2) Trust Approver (Checker) — Owner today
Typical: managing attorney / owner.

Can:
- Approve/reject trust transactions
- Approve/reject voids
- Approve/reject monthly reconciliation
- View all reports

Cannot (by default):
- Be the maker on items they approve (system-enforced)

### 3) Central Finance Approver (future)
Enterprise role for multi-location.

Can:
- Approve transactions/reconciliations across offices they’re assigned
- Reopen reconciliations (with reason)

Constraints:
- Cannot approve transactions they created (maker/checker).

### 4) Regional Owner / Office Manager (future)
Approver scoped to one office/region.

Can:
- Approve for their office only

### 5) Trust Admin
Highly restricted.

Can:
- Manage trust bank accounts (create/close)
- Manage role assignments
- Configure CosmoLex integration credentials/settings
- Grant adjustment permission

Should not be a day-to-day operational user.

---

## Permissions (granular)

Suggested permission strings:

### Transactions
- `trust.txn.create`
- `trust.txn.update_draft`
- `trust.txn.submit`
- `trust.txn.approve`
- `trust.txn.reject`
- `trust.txn.void.request`
- `trust.txn.void.approve`
- `trust.txn.adjustment.create`
- `trust.txn.view`

### Statements & matching
- `trust.statement.import`
- `trust.statement.view`
- `trust.match.create`
- `trust.match.delete`

### Reconciliation
- `trust.recon.create`
- `trust.recon.update`
- `trust.recon.submit`
- `trust.recon.approve`
- `trust.recon.reopen`
- `trust.recon.view`

### Reporting
- `trust.reports.view`
- `trust.reports.export`

### Integration
- `trust.cosmolex.view_status`
- `trust.cosmolex.retry_push`
- `trust.cosmolex.configure` (admin-only)

### Administration
- `trust.admin.manage_accounts`
- `trust.admin.manage_roles`

---

## Separation of duties (SoD) rules (system-enforced)

### Rule 1 — Maker/checker
- A user may not approve a transaction they:
  - created, OR
  - submitted for approval

### Rule 2 — Reconciliation maker/checker
- A user may not approve a reconciliation they:
  - prepared, OR
  - submitted

### Rule 3 — Adjustments and voids
- Adjustments and void approvals require `trust.txn.adjustment.create` and `trust.txn.void.approve` respectively.
- Always audit who initiated vs who approved.

### Rule 4 — Immutable posted ledger
- No one (including admin) can edit posted ledger entries.
- Admin actions are limited to configuration, not rewriting history.

---

## Audit events for access control

Log these events:
- `trust.permissions.role_assigned`
- `trust.permissions.role_revoked`
- `trust.permissions.permission_granted`
- `trust.permissions.permission_revoked`

Include:
- actor
- subject user
- scope (office/region)
- reason (required)
