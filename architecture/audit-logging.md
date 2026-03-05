# Legacy Guardians — Audit Logging

This document defines audit logging requirements for Legacy Guardians (LG), emphasizing legal work product and trust accounting.

## Objectives

- Provide **tamper-evident** records of who did what, when, and from where.
- Support investigations, client disputes, regulatory audits, and incident response.
- Minimize sensitive data in logs while maintaining forensic value.

## Audit Event Coverage (minimum)

### Identity & Security
- user created/deactivated
- role/permission changes
- magic-link: token issued, email sent, redeemed, failed redemption
- step-up auth prompts/outcomes
- MFA changes (if applicable)
- API key creation/rotation/revocation
- session events (logout, refresh rotation)

### Data Access & Exports
- document upload/view/download
- attorney notes view/create/edit
- access to Level 3 resources (at least)
- bulk exports: scope + record counts

### Trust Accounting (Level 4)
- ledger create/edit/void (matter-scoped)
- disbursement batch create/approve/reject/export
- monthly **three-way reconciliation** runs and posted results
- lawyer approval recorded for each reconciliation
- backdated/corrective adjustments
- **earned-fee transfer (trust → operating)** initiated/approved/posted **tied to an invoice**
- CosmoLex sync events that affect financial state

### Integrations
- Lawmatics: webhook receipt, mapping changes, sync reads/writes
- CosmoLex: payload sent, response, retry, idempotency key, failure

### Admin / Governance
- retention policy changes
- legal hold placed/removed
- support break-glass enabled/disabled

## Event Schema (structured)

Each event should include:
- `event_id` (UUID)
- `timestamp` (UTC)
- `actor_type` (staff|client|system|support)
- `actor_id`
- `firm_id`
- `ip`, `user_agent`, optional `device_id`
- `action` (e.g., `trust.disbursement.approve`)
- `resource_type`, `resource_id`
- `result` (success|failure) + `failure_reason`
- `request_id` / trace id
- small `metadata` (redacted)

For **trust accounting** actions, additionally include (as top-level fields if possible):
- `matter_id` (required; ledgers are matter-level)
- `trust_bank_account_id` (for Stage 1 this will usually be a single IOLTA account per firm)
- for earned-fee transfers: `invoice_id`, `invoice_number`, and `external_invoice_ref` (e.g., CosmoLex invoice id)

**Never include:** raw magic-link tokens, document contents, attorney note contents, full bank account numbers.

## Storage & Tamper Evidence

- Store audit logs in append-only storage separated from the primary app DB.
- Restrict write permissions to the logging pipeline.
- Add tamper evidence (choose at least one):
  - hash chaining per tenant/day
  - WORM/immutability controls (if available)

## Retention

- General audit logs: **>= 7 years recommended**.
- Trust-accounting-related audit logs: **indefinite where feasible**.

## Alerting (derived signals)

Alert on:
- repeated magic-link failures or unusual geo/device redemption
- bulk downloads/exports
- staff touching many matters rapidly
- trust approvals outside business hours
- frequent backdated edits/voids
- integration failures that could desync accounting

## Access to Audit Logs

- Limit to Partner/Owner + designated security admins.
- Any access to audit logs is itself audited.
- Provide an audit viewer UI with export controls.

## Implementation Notes

- Use consistent action naming and versioning.
- Ensure time synchronization across services.
- Consider tagging events with data classification (2/3/4).

## Clarifications applied (2026-03-05)

- **Single IOLTA account (Stage 1):** audit events still record `trust_bank_account_id`, but expect a single firm-level account initially.
- **Ledgers are matter-level:** require `matter_id` on trust-ledger, disbursement, reconciliation, and adjustment events.
- **Earned-fee transfers require an invoice:** trust → operating transfers must log invoice linkage (internal + external/CosmoLex reference).
