# Legacy Guardians — Roadmap

Version: v0.2
Date: 2026-03-05

Roadmap is staged to de-risk the hardest value first: **spotless VA document assembly** + operational minimums (trust accounting, integrations).

## Stage 0 — Definition + assets (1–3 weeks)
**Outcome:** a testable, buildable Stage 1 scope.
- Collect anonymized **VA templates** and golden-sample outputs.
- Translate questionnaire into a structured field inventory.
- Enumerate clause logic rules per document.
- Define the **minimum safe dataset** required to assemble.
- Define trust accounting day-1 requirements (reports, validations, approvals).
- Confirm integration scope:
  - Lawmatics objects/fields (CRM source of truth)
  - CosmoLex push method (API/CSV)
- Define retention/immutability mechanics for executed scans + attorney notes.

## Stage 1 — Virginia document assembly MVP (6–10 weeks)
**North star:** attorney clicks “Assemble” and gets a Word-ready VA packet matching the firm’s quality bar.

### 1A — Foundations
- Auth + RBAC (staff vs client).
- Magic-link client portal.
- Matter model + matter types (shallow support for non-EP types).
- Questionnaire UI (fixed schema) + validations + autosave.
- Basic pipelines with **editable stages**.

### 1B — Templates + assembly engine (VA)
- Template upload + versioning.
- Merge fields, conditional clauses, repeating blocks.
- Packet composition per `spec/document-packets.md`.
- Export .docx.
- Assembly run history (traceability).

### 1C — Quality gates + auditability
- Completeness checklist + rules-based issue flags.
- Determinism checks and regression tests against golden samples.
- Output formatting QA process.

### 1D — Day-1 trust accounting + billing push
- Trust ledger transactions + reporting + audit.
- Time entry capture.
- Export/push time/billing (and any trust-related exports as required) to **CosmoLex**.

### 1E — Lawmatics integration baseline
- Ingest/sync contacts/matters/pipeline metadata per agreed scope.

## Stage 2 — Maryland expansion (4–8+ weeks)
- Add **Maryland** template set(s) and state-specific rules.
- Expand packet definitions as needed.
- Harden multi-jurisdiction testing and QA automation.

## Stage 3 — Matter-type workflow depth (6–12 weeks)
- Deeper workflows for:
  - Probate estate administration (VA)
  - Trust administration
  - One-off deeds
  - Fiduciary & Continuity Program
- Matter timeline and tasking (as needed for these workflows).

## Stage 4 — CosmoLex replacement decision + execution (deadline: Jan 2027)
Two tracks:
- **Track A:** integrate/migrate to **QuickBooks Online (QBO)**.
- **Track B:** build native accounting (higher scope/risk).

## Stage 5 — Metricool replacement (future, in-scope)
- Social scheduling + engagement reporting.
- Publishing + approvals + analytics.

## Stage 6 — Multi-location finance (TBD)
- Inter-company accounting for MSO model (explicitly deferred).
