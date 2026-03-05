# Legacy Guardians — Data Classification

This document defines a practical data classification scheme for Legacy Guardians (LG), an estate planning + administration law firm SaaS.

Scope includes: client portal (magic link), firm/staff operations, trust accounting and financial records, and integrations with Lawmatics (CRM source of truth) and CosmoLex (billing/accounting destination until Jan 2027).

## Goals

- Make controls implementable: encryption, access control, logging, retention, incident response.
- Call out special handling for **trust accounting** and **legal work product**.
- Provide labels engineers can apply to DB tables/columns, files, events, and integration payloads.

## Classification Levels

Use a simple sensitivity ladder.

### Level 0 — Public
**Definition:** Intended for public consumption.

**Examples:** marketing pages, non-client documentation.

**Controls:** standard web security; integrity via CI/CD.

### Level 1 — Internal
**Definition:** Non-public operational info; limited harm if disclosed.

**Examples:** operational metrics without client identifiers; internal runbooks without secrets.

**Controls:** authenticated access; encryption in transit.

### Level 2 — Confidential (Client/Business)
**Definition:** Client-related or business data that could cause harm if disclosed.

**Examples:**
- Matter metadata (names, matter type, key dates, status)
- Contact details (address, phone, email)
- Time entries and invoices *without* banking details

**Controls:**
- Least-privilege RBAC + matter scoping
- Encryption in transit + at rest
- Audit logs for access/modification
- Export controls where feasible

### Level 3 — Restricted (Legal Work Product & Credentials)
**Definition:** Highly sensitive; disclosure may violate privilege or cause serious harm.

**Examples:**
- Attorney notes, privileged communications, strategy memos
- Scanned executed documents (wills, trusts, deeds, POAs)
- Authentication secrets (API keys, signing keys)
- Magic-link tokens (before redemption)

**Controls:**
- Envelope encryption (KMS) + strict key access policies
- Per-object access checks; deny-by-default sharing
- Immutable audit logging (append-only)
- Egress monitoring for bulk exports
- Secrets stored only in a secrets manager (never in DB logs)

### Level 4 — Regulated Financial (Trust Accounting)
**Definition:** Data used to track or effect movement of money, especially client trust funds; highest integrity requirements.

**Examples:**
- **Matter-level** trust ledger transactions and balances (Stage 1: posted against a single firm IOLTA account)
- Reconciliations, adjustments, voids
- Bank account/routing numbers (if stored), check images
- Earned-fee transfers (trust → operating), including **invoice linkage fields** (`invoice_id`, `invoice_number`, `external_invoice_ref` such as CosmoLex invoice id)
- CosmoLex sync payloads that affect accounting state

**Controls (minimum):**
- Segregation of duties (create vs approve vs reconcile)
- Dual control/4-eyes approval for risky actions
- Strong idempotency + tamper-evident event trails
- Immutable audit logs + time sync
- Strict rate limits + anomaly detection
- Retention aligned with audits; preserve long-term

## Data Domains & Labels

Tag each data object with one primary label and optional secondary tags.

### Primary domains
- **Identity & Access** (Level 3)
- **Matter Management** (Level 2)
- **Documents & Notes** (Level 3)
- **Billing & Time** (Level 2 → 4)
- **Integrations** (inherits underlying data level)
- **Support & Ops** (Level 1–3)

### Secondary tags
- **PII** (personal data)
- **Privilege** (attorney-client / work product)
- **Trust** (trust accounting)
- **Credential** (secret/token material)

## Storage Guidance

### Databases
- Keep **Level 3/4** fields isolated (tables/columns) to simplify tighter access controls.
- Enforce row-level authorization: `firm_id` + `matter_id`.
- Store magic-link tokens as **hash + metadata** (no reversible storage).

### Document storage
- Treat all uploads as **Level 3** by default.
- Separate object metadata (Level 2) from contents (Level 3).
- Virus scan + content-type validation on upload.

### Logs & analytics
- Never log document contents, attorney notes, bank account numbers, or auth tokens.
- Use structured logging with field-level redaction.

## Integrations

- **Lawmatics:** inbound contact/matter data is Level 2; restrict sync scope; store pointers to source-of-truth ids.
- **CosmoLex:** treat outbound billing/trust sync artifacts as Level 4 when they can affect accounting; verify signatures/webhooks where possible.

## Default Handling Rules

- New field default: **Level 2**.
- New file upload default: **Level 3**.
- If unsure whether financial: classify as **Level 4** until confirmed.

## Clarifications applied (2026-03-05)

- Stage 1 assumes **one firm-level IOLTA trust bank account**; however, ledger boundaries are still **matter-level** (so `matter_id` remains a key classification/authorization attribute).
- Earned-fee transfers must be **invoice-linked**; invoice identifiers and external references (e.g., CosmoLex invoice id) are treated as Level 4 when they authorize or evidence movement of trust funds.
