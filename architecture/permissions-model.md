# Legacy Guardians — Permissions Model

This document proposes an authorization model for Legacy Guardians (LG) that supports:
- multi-tenant law firms
- client portal access via magic links
- strong controls for **trust accounting**
- auditability for regulated workflows

## Core Concepts

### Tenancy
- **Firm** is the tenant boundary.
- Every record is scoped by `firm_id`.
- Cross-firm access is forbidden except for internal support via explicit, time-bound break-glass.

### Principals
- **Firm Staff User** (attorney/paralegal/admin/billing/trust)
- **Client User** (client/executor/beneficiary)
- **System/Integration** (Lawmatics sync, CosmoLex sync)
- **LG Support** (break-glass only)

### Resources
Matters, contacts, tasks, documents, attorney notes, time/invoices, trust ledgers/reconciliations, integration configs, audit logs.

## RBAC + Matter Membership

Use firm-level RBAC plus matter-level membership for matter-scoped resources.

### Recommended firm roles
- **Partner / Firm Owner**: full access, security settings, approve trust actions.
- **Attorney**: full access to assigned matters; create notes/docs.
- **Paralegal / Staff**: access to assigned matters; cannot approve trust disbursements.
- **Billing**: access to time/invoices; no attorney notes by default.
- **Trust Accounting Clerk**: create ledger entries, prepare disbursements, run reconciliations; cannot self-approve.
- **Trust Approver**: approve/reject disbursements/adjustments.
- **Firm Admin**: user management, integration settings; no default access to attorney notes.
- **Read-only/Auditor**: view configured reports; exports disabled by default.

### Matter membership rules
For Level 2/3 resources, require:
- role allows the action AND
- user is on the matter team OR has an explicit firm-level override (Partner).

## Client Portal Permissions

### Defaults
Clients can:
- view matter status and client-visible tasks
- upload documents to a matter (uploads treated as Restricted until reviewed)
- download only documents explicitly shared with them

Clients cannot (by default):
- view attorney notes
- view internal time entries
- view trust ledger details unless explicitly enabled (usually not)

### Document sharing ACL
Each document has a share policy:
- `internal_only`
- `shared_with_clients` (explicit list)
- `shared_via_link` (discouraged; if used, short-lived + logged)

## Trust Accounting Controls (Level 4)

Trust accounting actions have higher integrity requirements.

**Clarifying assumptions (Stage 1):**
- There is **one IOLTA trust bank account per firm** initially.
- Trust **ledgers are matter-level** (no shared/cross-matter ledgers), even though the underlying bank account is firm-level.

### Sensitive actions
- create/modify ledger entry (must be scoped to a `matter_id`)
- create disbursement batch
- approve/reject disbursement
- post reconciliation
- backdated/corrective edits
- initiate/approve/post **earned-fee transfer (trust → operating)** (must reference an invoice)

### Segregation of duties (SoD)
- Creator cannot approve their own disbursement.
- Backdated edits/voids require approval and are always audited.
- **Earned-fee transfers:** the user who initiates the transfer cannot be the sole approver.

### Step-up authentication
Require re-auth for:
- trust approvals (including earned-fee transfers)
- exports
- integration configuration changes
- security/permission changes

### CosmoLex integration permissions
- Integration agent can read approved financial events and write sync status.
- Integration agent cannot approve or create disbursements.
- For earned-fee transfers, the integration agent may store/update **invoice linkage fields** (e.g., CosmoLex invoice id/number) but cannot originate a transfer.

## LG Support Break-Glass

- Disabled by default.
- Requires customer approval (or documented emergency policy), ticket + justification.
- Time-bound with automatic revocation.
- Full audit trail (and session recording if feasible).

## Clarifications applied (2026-03-05)

- Stage 1 assumes **one firm-level IOLTA trust bank account**; all trust activity remains **matter-scoped** via matter-level ledgers.
- Trust ledgers are **not shared across matters**; permissions for ledger/disbursement/reconciliation actions must enforce `matter_id` membership (Partner overrides still allowed).
- Earned-fee transfers (trust → operating) must be **tied to an invoice** (internal invoice id + optional CosmoLex invoice reference during interim).
