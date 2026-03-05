# Legacy Guardians — Product Requirements Document (PRD)

Version: **v0.2**
Date: 2026-03-05
Owner: Product (PRD subagent)

## 0) Executive summary
Legacy Guardians (LG) is a SaaS platform for an estate planning + administration law firm. The current operating stack is fragmented:
- **Lawmatics**: CRM and pipeline source of truth (initially)
- **CosmoLex**: billing/accounting system of record (initially)
- **(Legacy) drafting tooling**: document assembly/templates

This fragmentation causes duplicate data entry, inconsistent records, slower throughput, and avoidable quality risk in complex drafting packets.

**Stage 1 (Virginia):** ship a production-grade **document assembly** workflow for a VA estate planning packet (typically **120–130 pages**) with **spotless formatting**.

**Stage 2 (Maryland):** expand the assembly system and templates to MD.

## 1) Problem statement
- Data is re-entered across systems (CRM → drafting → billing/accounting).
- Drafting packet quality is heavily checklist-driven and vulnerable to missing/incorrect inputs.
- Client experience is inconsistent and high-friction.
- Leadership lacks consistent management reporting across matters and locations.

## 2) Goals and success metrics
### 2.1 Stage 1 goals (Virginia)
1. **VA document assembly MVP (production quality)**
   - Generate the baseline VA estate planning packet defined in `spec/document-packets.md`.
2. **Attorney-in-the-loop deterministic drafting**
   - Review inputs, run assembly, re-run with identical determinism and traceability.
3. **Client portal with magic-link auth**
   - Clients complete questionnaire and upload required documents with minimal friction.
4. **Trust accounting from day 1 (minimum viable compliance)**
   - Support trust ledger concepts and reporting needed for operations, even while pushing billing/accounting to CosmoLex.
5. **Lawmatics integration as CRM source of truth (initially)**
   - LG can ingest contacts/matters/pipeline metadata from Lawmatics and avoid competing “truths.”

### 2.2 Stage 1 success metrics
- **Output quality:** internal QA pass rate (no manual formatting cleanup beyond attorney preference); zero “broken” packets.
- **Time-to-draft:** p95 < 15 minutes from “Assemble” to downloadable packet (system time).
- **Completeness:** measurable reduction in missing critical fields vs baseline.
- **Re-run determinism:** same inputs + same template version produces byte-identical output (or documented deterministic deltas like timestamps are excluded).

### 2.3 Post–Stage 1 goals
- Stage 2: Maryland templates + rules.
- Expand matter-type workflows (probate VA, trust admin, deeds).
- Replace/augment CosmoLex by **Jan 2027** (deadline for decision: native vs QBO migration).
- Add social scheduling + engagement reporting (Metricool replacement) as an in-scope future module.

## 3) Scope by stage (high-level)
### Stage 1 (VA) — tightly scoped
- Estate planning matter workflow sufficient to:
  - capture structured data,
  - validate completeness,
  - assemble the specified VA document packet,
  - export Word-ready docs.
- Minimal matter/pipeline functionality required to operate drafting.
- Timekeeping and billing capture in LG, **push to CosmoLex**.
- Trust accounting: minimum ledger support and export/compatibility with CosmoLex workflows.

### Stage 2 (MD)
- Maryland jurisdiction templates and rules for the same baseline packet family.

## 4) Users and personas
### Internal
- **Attorney (primary Stage 1 user):** owns review + assembly; finalizes in Word.
- **Paralegal/intake specialist:** supports questionnaire completion; manages data quality.
- **Firm admin/ops:** pipeline administration, reporting, template management.

### External
- **Client:** completes questionnaire and uploads docs via magic link.

## 5) Authoritative decisions / constraints
- **Jurisdictions:** Stage 1 = **Virginia**; Stage 2 = **Maryland**.
- **Stage 1 document pack:** see `spec/document-packets.md`.
- **Portal authentication:** **magic link**.
- **Trust accounting:** must be supported **from day 1**.
- **Matter types:** see `spec/matter-types-and-pipelines.md`.
- **Pipelines exist; stages must be editable**.
- **Integrations:**
  - **Lawmatics** is CRM source of truth initially.
  - LG records time/billing but **pushes to CosmoLex** until **Jan 2027**.
- **Data retention:**
  - retain matter metadata for **5 years** minimum.
  - **never delete** scanned executed documents or attorney notes (design as immutable/indefinite retention).
- **Assembly quality:** baseline packet **120–130 pages**; formatting must be **spotless**.
- **Multi-location:**
  - “Location” represents a **regional owner** with multiple offices (MSO model).
  - Matters are transferable between locations.
  - Management reporting now; inter-company accounting later (TBD).

## 6) Integrations and system boundaries
### 6.1 Source-of-truth rules (initial)
- **Lawmatics:** contact + lead + pipeline CRM source of truth.
- **LG:** drafting questionnaire data; template versions; assembly run history; client uploads; attorney notes (if captured in LG).
- **CosmoLex:** accounting and billing system of record through Jan 2027; LG must sync/push required billing artifacts.

### 6.2 Explicit boundaries (we integrate, don’t replace UIs)
- Email UI: Google/Gmail
- Video conferencing UI: Zoom
- Payments UI: LawPay
- File storage UI: Dropbox (or staged migration path)
- Phone UI: RingCentral/Zoom Phones; CallRail for tracking

## 7) Stage 1 functional requirements (VA assembly MVP)
### 7.1 Matter model (minimum)
- Matter types supported per `spec/matter-types-and-pipelines.md`.
- Location model:
  - location = regional owner
  - multiple offices per location (office metadata may be shallow at Stage 1)
  - matters transferable (retain transfer audit trail)
- Household/relationships:
  - support joint matters (spouses/partners) and individual reciprocal scenarios.

### 7.2 Questionnaire + structured data capture
- Fixed schema for Stage 1 (builder can be later).
- Field types: text, number, currency, date, yes/no, select, multi-select, repeating groups (children, fiduciaries, assets, real property), addresses.
- Conditional requiredness and validation.
- Save/resume + autosave.
- Staff-assisted completion with attribution and audit.

### 7.3 Client portal (magic link)
- Invite client via email magic link.
- Link security:
  - short-lived tokens + refresh flow (or re-send),
  - rate limiting,
  - device/session management as feasible.
- Client can upload supporting documents.

### 7.4 Template management + assembly engine
- Upload + version templates.
- Merge fields, conditional clauses, repeating blocks.
- Deterministic output given inputs + template version.
- Packet generation based on selected packet definition.
- Export formats: **.docx** primary (RTF acceptable if needed).

### 7.5 Review, auditability, and traceability
- Data completeness checklist (required vs recommended).
- Issue flags (non-AI baseline): contradictions, missing guardians, missing fiduciaries, etc.
- Assembly run record:
  - who/when
  - template versions
  - input snapshot/hash
  - output artifact references

### 7.6 Trust accounting (Day 1 required)
LG must support trust accounting from day 1, including:
- **client/matter-level balances** with strict **no-negative-balance** enforcement (no override in normal flows)
- transaction types at minimum: receipts, disbursements, transfers, bank fees/charges, earned-fee transfers (trust → operating), adjustments/voids
- reporting:
  - client/matter trust ledger (running balance)
  - trust trial balance (sum of client ledgers)
  - **three-way reconciliation** support (bank balance vs book balance vs sum of client ledgers)
- an auditable reconciliation workflow (saved runs + adjustment trail)
- pushing/exporting trust transactions to **CosmoLex** during the interim period (until Jan 2027), with idempotency + retry visibility

Note: Stage 1 can still defer full general-ledger bookkeeping, bank feeds, and broad financial reporting, but trust-ledger integrity and reconciliation are non-negotiable.

### 7.7 Timekeeping + billing (with CosmoLex push)
- Capture time entries in LG associated to matter.
- Generate billing artifacts required to push to CosmoLex (rates/UTBMS codes if used, invoice drafts as needed).
- The authoritative accounting remains in CosmoLex through Jan 2027.

### 7.8 Pipelines (editable)
- Support pipelines and editable stages per `spec/matter-types-and-pipelines.md`.
- Minimum UI: move matter between stages; stage change audit.

### 7.9 Management reporting (Stage 1)
- Basic reporting by:
  - location
  - matter type
  - pipeline stage
  - assembly throughput/turnaround metrics

## 8) Non-functional requirements
### 8.1 Output quality bar (explicit)
- Packet output must be “send to client/print-ready” quality in Word:
  - no broken numbering
  - consistent headers/footers
  - correct cross-references
  - consistent styles
  - no orphaned conditional text
- QA process must include golden-sample comparisons.

### 8.2 Security and privacy
- TLS in transit; encryption at rest.
- RBAC for firm roles; server-side authorization.
- Audit logs for: auth events, edits, exports, template changes, assembly runs, trust transactions.

### 8.3 Data retention
- Matter metadata retained ≥ 5 years.
- Executed scans + attorney notes: **never delete** (design as immutable/indefinite retention; allow legal holds).

## 9) Risks and dependencies
- Assembly quality and deterministic formatting are the highest-risk areas (Word styles/numbering, conditional blocks).
- Trust accounting is compliance-sensitive; must be correct even if minimal.
- Integration constraints (Lawmatics + CosmoLex) require clear source-of-truth boundaries.
- Multi-location MSO model introduces reporting/transfer complexity; keep inter-company accounting explicitly deferred.

## 10) Related artifacts
- Document packets: `spec/document-packets.md`
- Matter types and pipelines: `spec/matter-types-and-pipelines.md`
- User stories: `spec/user-stories.md`
- Acceptance criteria: `spec/acceptance-criteria.md`
- Non-goals: `spec/non-goals.md`
- Open questions: `spec/open-questions.md`
- Roadmap: `spec/roadmap.md`
