# Legacy Guardians — Acceptance criteria

Version: v0.2
Date: 2026-03-05

Acceptance criteria are grouped by Stage 1 epics. Stage 1 is **Virginia**.

## Epic 1: Client portal + questionnaire (magic link)
### AC1 — Magic link authentication
- Client can access the portal via a magic link delivered by email.
- Magic links are single-use or expire within a configured TTL.
- The system supports re-issuing links without exposing prior links.

### AC2 — Questionnaire persistence
- Client questionnaire autosaves.
- Client can resume later on the same or different device.
- Staff can view status: Not started / In progress / Submitted.

### AC3 — Field validation
- Required fields block submission with clear, human-readable messages.
- Conditional requiredness works (e.g., if “Has children” = Yes, at least one child entry is required).
- Repeating groups (children, assets, fiduciaries, properties) support add/edit/remove.

### AC4 — Staff-assisted completion + audit
- Staff can edit questionnaire answers on behalf of a client.
- The system records who changed what and when (field-level or section-level audit, minimum viable).

## Epic 2: Templates + packet definition (VA)
### AC5 — Template upload and versioning
- Admin/attorney can upload templates.
- Templates are versioned; older versions remain accessible.
- Each assembly run references the exact template version(s) used.

### AC6 — Packet composition
- The Stage 1 VA packet contains the documents listed in `spec/document-packets.md`, including the **Summary of Client Information**.
- “Assemble” produces all packet documents for the matter’s selected packet.

### AC7 — Merge/logic support
- Templates can reference structured fields.
- Conditional clauses and repeating blocks render correctly.
- Missing required fields cause assembly to **block** with a clear missing-field list (default safe behavior).
- **Pour-over will rule:** if the selected packet includes a living trust, the will produced is a **pour-over** will; if standalone will is selected, no trust documents are assembled.

## Epic 3: Assembly run + export (VA)
### AC8 — Run assembly
- Attorney can initiate “Assemble packet” from a Matter.
- The system generates Word-ready outputs for each document in the VA packet.

### AC8a — Deed legal description extraction (HITL)
- User can upload a prior deed.
- System extracts the legal description candidate text.
- A human must review/confirm (and may edit) the extracted legal description before it is used in the assembled deed.
- The assembled deed uses the confirmed legal description and preserves required formatting (line breaks/indentation rules as defined in templates).

### AC9 — Export
- Outputs can be downloaded as **.docx**.
- Filenames follow a consistent pattern (configurable at least by template/packet).

### AC10 — Determinism + traceability
- Assembly runs are recorded with: timestamp, user, template version(s), and an input snapshot/hash.
- Re-running with identical inputs + template versions yields identical outputs (excluding explicitly allowed non-deterministic metadata).

## Epic 4: Review + quality bar
### AC11 — Completeness checklist
- Prior to assembly, attorney can view a checklist of required/important fields.
- Checklist links directly to the relevant inputs for correction.

### AC12 — Issue flags (rules-based baseline)
- The system flags obvious inconsistencies (e.g., married but spouse missing; minor children but no guardian).
- Flags are explainable and point to specific inputs.

### AC13 — Formatting quality gate
- Output meets the “spotless packet” bar:
  - numbering is correct
  - headers/footers render correctly
  - styles are consistent
  - no orphaned conditional text
  - body text defaults to **12pt Times New Roman** and **1" margins** (unless a specific template section defines otherwise)
  - signature blocks/lines render correctly (no broken alignment/wrapping)
  - will + trust support page-by-page **initial lines** where required
- A defined QA process exists (golden samples + regression checks) for template changes.

## Epic 5: Pipelines (editable) + reporting
### AC14 — Editable pipelines
- Authorized admins can create/edit/reorder/archive pipeline stages.
- Stage changes are audited.

### AC15 — Basic reporting
- Users can view counts of matters by: location, matter type, pipeline stage.

## Epic 6: Trust accounting (Day 1 required)
Trust accounting is **required from day 1**. The system must maintain **client-level (matter-level) trust balances** and prevent negative balances at all times.

### AC16 — Trust ledger: transaction types + constraints
- Users can record trust transactions with at minimum:
  - type: **receipt**, **disbursement**, **transfer**, **bank fee/charge**, **earned fee transfer** (trust → operating), **adjustment/void**
  - date (with clear rules for backdating)
  - amount
  - payor/payee
  - memo
  - matter association (and, if needed, client/household association)
  - reference (check # / external id) where applicable
  - manner (check | wire | ACH | cash | card | other) to satisfy “manner received/disbursed/transferred” recordkeeping expectations
- The system enforces **no-negative-balance** at the client/matter level:
  - a transaction that would create a negative balance is blocked (no override in normal flows)
  - blocked attempts are logged/audited
- Deposits are recorded **intact**.
- If a mixed trust/non-trust deposit is recorded, the system supports marking the non-trust portion for withdrawal **after clearing** (and tracks it explicitly).

### AC17 — Required trust reports
- The system can produce (exportable) reports:
  - **Client/matter trust ledger** (transactions + running balance)
  - **Trust trial balance** (sum of client ledgers)
  - **Three-way reconciliation** report that supports the required workflow:
    - bank statement ending balance
    - book balance (trust bank account ledger)
    - sum of client/matter ledgers
    - discrepancies are highlighted

### AC18 — Reconciliation workflow (minimum viable, VSB Rule 1.15)
- The system supports **monthly** trust account reconciliations and enforces a workflow consistent with VSB Rule 1.15:
  1) reconcile each **client ledger balance** (sum of client ledgers)
  2) reconcile the **trust account bank balance** (adjusted bank statement balance = checkbook/transaction register)
  3) reconcile (2) with (1): trust account balance must equal client ledger balance
- Reconciliation runs are saved, immutable, and auditable (who ran it, when, inputs used).
- A **lawyer approval** is recorded for each monthly reconciliation (maker/checker), including timestamp and approver identity.
- Corrections after a reconciliation require explicit adjustment transactions and are auditable.

### AC19 — Trust audit trail + integrity
- Trust transaction create/edit/void actions are auditable (who/when/what changed).
- The system maintains the minimum record types required by Rule 1.15:
  - receipts/disbursements journals (or a transaction register that includes equivalent fields)
  - a client ledger with a separate record per client/matter, including running balance
- Trust-related audit events include sufficient metadata to trace:
  - original source (manual entry vs integration import)
  - external ids for idempotency
  - reconciliation run ids and lawyer approval ids

### AC20 — Push trust transactions to CosmoLex (interim system of record)
- LG can push/export trust transactions to CosmoLex with:
  - idempotency keys to prevent duplicates
  - retry with clear error visibility
  - reconciliation of what was sent vs acknowledged
- Daily deposit reporting from **LawPay** can be imported or ingested and represented as trust receipts (mechanism may evolve; day-1 can be manual upload + mapping).

## Epic 7: Timekeeping + billing push to CosmoLex
### AC21 — Time entries
- Users can record time entries against a matter with date, duration, narrative, billable/non-billable.

### AC22 — CosmoLex export/push (time + billing)
- LG can export or push time/billing data in a format compatible with CosmoLex workflows.
- Failures are visible and retryable (at minimum: an error log and manual re-export).

## Epic 8: Data retention
### AC23 — Retention policy enforcement
- Matter metadata is retained for at least **5 years**.
- Executed scans and attorney notes are never deleted via normal product flows.

## Performance acceptance
### AC24 — Assembly time
- For the baseline VA packet and a typical matter, p95 assembly time < 15 minutes.

### AC25 — Usability
- Client questionnaire completion does not require training.
- Error states are actionable and non-technical.
