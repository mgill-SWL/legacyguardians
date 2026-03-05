# Legacy Guardians — Matter types and pipelines

Version: v0.2
Date: 2026-03-05

This document defines the **supported matter types** and how pipelines/stages are expected to behave.

## Matter types (authoritative list)
Stage 1 must support creating and operating the following matter types (even if only one is fully featured at MVP):

1. **Estate Planning**
2. **Fiduciary & Continuity Program**
3. **Probate estate administration (VA only)**
4. **Trust administration**
5. **One-off deeds**

### Stage 1 focus
- **Primary (deep support):** Estate Planning (VA) → document assembly and packet generation.
- **Secondary (shallow support):** other matter types exist for tracking, intake, and reporting, but can defer specialized workflows to later stages.

## Pipelines: product requirements
### Core requirements (Stage 1)
- A matter has exactly one **Matter Type** and exactly one active **Pipeline** (initially defaulted per matter type).
- A pipeline is a named set of ordered **Stages**.
- **Pipeline stages must be editable** by authorized firm admins:
  - create/edit/archive pipelines
  - add/reorder/rename stages
  - configure which stages are valid for which matter types
- Stage changes must be **auditable** (who/when).

### What “editable” means (minimum)
- If a stage is renamed, historical events keep referencing the stage id (not just the name).
- If a stage is archived, matters already in that stage still render correctly.

## Suggested default pipelines (starting point)
These are defaults to seed the system; the firm can modify.

### A) Estate Planning (VA) — default pipeline
1. New / Unassigned
2. Intake
3. Consult Scheduled
4. Engaged (Fee Agreement Signed)
5. Drafting Questionnaire In Progress
6. Attorney Review
7. Assembly / Draft Packet Generated
8. Execution / Signing
9. Funding / Deeds / Post-Signing Tasks
10. Closed

### B) Fiduciary & Continuity Program — default pipeline
1. Enrolled
2. Annual Review Due
3. Updates in Progress
4. Completed

### C) Probate estate administration (VA only) — default pipeline
1. Opened
2. Qualification / Letters
3. Inventory / Accounts
4. Creditor Period
5. Distributions
6. Closing

### D) Trust administration — default pipeline
1. Opened
2. Initial Review
3. Accounting / Reporting
4. Distributions
5. Ongoing

### E) One-off deeds — default pipeline
1. Requested
2. Drafting
3. Review
4. Execution
5. Recording (if applicable)
6. Closed

## Reporting implications (Stage 1)
- The system must support **management reporting** by:
  - matter type
  - pipeline stage
  - location (see PRD for the location model)
- Inter-company accounting for the MSO model is explicitly deferred (TBD).
