# Legacy Guardians — Retention Policy

This document describes retention and deletion rules for Legacy Guardians (LG), with special constraints for legal practice and trust accounting.

Authoritative requirements:
- **Matter metadata**: retain **5 years** (legal requirement).
- **Never delete**: scanned executed documents **or** attorney notes.

## Principles

1. **Minimum necessary deletion**: delete only when allowed and safe.
2. **Legal hold wins**: any legal hold suspends deletion.
3. **Immutability for critical evidence**: audit logs and key accounting trails are append-only.
4. **Separate “deactivate” from “delete”**: archive and restrict access rather than removing.

## Retention Categories

### A) Matter Metadata (Required 5 years)
**Definition:** Identifiers and core details needed to understand what existed.

**Includes:** matter id, firm id, matter name/type, dates, status, participants; integration ids.

**Retention:** **>= 5 years after matter close** (or last activity if no close event).

**Deletion:** permitted only after retention period and if no legal hold; prefer anonymization over hard delete.

### B) Scanned Executed Documents (Never delete)
**Retention:** indefinite.

**Deletion:** not permitted (except if required by law/court order, with documented approval).

**Storage:** immutable object storage (versioning + retention lock if available); preserve original bytes and upload metadata.

### C) Attorney Notes / Work Product (Never delete)
**Retention:** indefinite.

**Deletion:** not permitted (same limited exception as above).

**Access:** strict RBAC; export limited.

### D) Trust Accounting Records (Treat as long-term/indefinite)
**Definition:** Matter-level ledgers, transaction events (including earned-fee transfers), reconciliation reports, adjustments, and their invoice linkage fields.

**Retention:** treat as **indefinite** unless counsel specifies statutory minimums.

**Deletion:** strongly discouraged; if ever allowed, requires (1) period elapsed, (2) no legal hold, (3) partner/admin approval, (4) immutable export archive.

### E) Billing/Time Entries
**Retention:** **>= 7 years recommended**, but align with counsel and CosmoLex requirements.

### F) Identity, Auth, and Security Data
- User accounts/roles: retain while account exists; keep minimal tombstone after deactivation.
- Magic-link tokens: retain hashed records for monitoring only (e.g., 30–90 days).
- Audit logs: **>= 7 years recommended**; trust-accounting audit events ideally indefinite.

### G) Integration Sync Artifacts
- Lawmatics: minimal necessary history (e.g., 90 days) plus pointers to source.
- CosmoLex: keep transaction-level references and outcomes (including **invoice references used to justify earned-fee transfers**); avoid storing full payloads if redundant; retain at least as long as trust accounting.

### H) Backups
- Backups inherit strictest retention requirement of contained data.
- Encrypt backups; log backup access.
- Document that deletions may persist in backups until backup expiry.

## Deletion vs. Anonymization

When deletion is allowed, prefer anonymizing direct identifiers while retaining the required “matter metadata skeleton” and audit trail integrity.

## Legal Holds & Exceptions

- Legal hold on a matter/firm prevents deletion/anonymization.
- Any exception to “never delete” requires documented legal basis, designated approval, immutable archive, and an auditable deletion event.

## Operational Implementation

- Implement retention as **policy-as-code** with scheduled jobs that:
  - identify eligible records
  - generate a review report
  - require explicit approval for destructive actions
- Provide admin UI for holds and retention status.
- Emit audit events for retention preview and execution.

## Clarifications applied (2026-03-05)

- Stage 1 assumes a **single IOLTA trust bank account per firm**; this does not change retention, but it reinforces the need to retain **matter-level ledger history** to reconstruct allocations within the single account.
- Trust ledgers are **matter-level**; retain `matter_id` associations indefinitely alongside trust transactions.
- Earned-fee transfers (trust → operating) must be **invoice-linked**; retain invoice linkage fields (and any interim CosmoLex invoice references) at least as long as trust accounting records.
