# Legacy Guardians — User stories

Version: v0.2
Date: 2026-03-05

Organized by Stage 1 (Virginia document assembly) vs later stages.

## Stage 1 (Virginia) — Document assembly MVP + minimum surrounding operations

### A) Attorney (drafting/assembly)
1. **As an attorney**, I want to open a Matter so that drafting inputs, templates used, and outputs are organized and traceable.
2. **As an attorney**, I want to view a structured summary of key client answers so that I can spot issues before assembly.
3. **As an attorney**, I want a completeness checklist (required vs recommended) so that I know what will block a safe assembly run.
4. **As an attorney**, I want to run “Assemble packet” for the VA estate planning packet so that I get a Word-ready draft output.
5. **As an attorney**, I want to export outputs as .docx so that I can finalize and send/print in Word.
6. **As an attorney**, I want to edit inputs and re-run assembly so that the packet stays consistent with updated answers.
7. **As an attorney**, I want every assembly run to record template versions and an input snapshot so that changes are defensible.

### B) Paralegal / intake staff
8. **As staff**, I want to invite a client via a magic link so that they can complete the questionnaire with minimal friction.
9. **As staff**, I want to see questionnaire status (not started / in progress / submitted) so that I can follow up appropriately.
10. **As staff**, I want to enter or correct answers on behalf of a client (with attribution) so that we can support clients who struggle.
11. **As staff**, I want validation feedback and missing-field lists so that I can fix problems before attorney review.

### C) Client (portal)
12. **As a client**, I want to access my questionnaire via magic link so that I don’t need to create a password.
13. **As a client**, I want autosave + resume later so that I can gather information over time.
14. **As a client**, I want plain-language explanations of questions so that I can answer confidently.
15. **As a client**, I want to upload supporting documents so that the firm has what it needs to draft.

### D) Templates + administration
16. **As an admin/attorney**, I want to upload and version VA templates so that assembly is repeatable and auditable.
17. **As an admin/attorney**, I want to define which templates comprise the VA packet so that “Assemble” produces the correct set every time.

### E) Pipelines (editable) + matter operations
18. **As a firm admin**, I want pipelines and stages to be editable so that the firm can match the system to its SOP.
19. **As staff**, I want to move matters between stages so that work status is visible.
20. **As leadership**, I want reporting by location, matter type, and pipeline stage so that I can manage operations.

### F) Trust accounting (Day 1 required)
21. **As accounting staff**, I want to record trust receipts/disbursements/transfers/fees/earned-fee transfers/adjustments against a matter so that trust balances are accurate.
22. **As accounting staff**, I want the system to prevent any transaction that would cause a negative client-level trust balance so that we remain compliant.
23. **As accounting staff**, I want a trust ledger report per matter/client (running balance) so that we can satisfy trust accounting requirements.
24. **As accounting staff**, I want a three-way reconciliation workflow/report (bank vs books vs sum of client ledgers) so that we can meet reconciliation requirements.
25. **As accounting staff**, I want LG to push trust transactions to CosmoLex with idempotency and error visibility so that CosmoLex stays accurate during the interim period.
26. **As accounting staff**, I want to import or enter daily LawPay deposit totals and map them to matters so that trust receipts are captured consistently.
27. **As accounting staff**, I want an audit trail for trust transactions and reconciliations so that we can explain any balance and changes over time.

### G) Timekeeping + billing (push to CosmoLex)
28. **As an attorney/staff**, I want to record time entries against a matter so that billing is accurate.
29. **As accounting staff**, I want LG to push time/billing data to CosmoLex so that CosmoLex remains the system of record through Jan 2027.

### H) Integrations (Stage 1 baseline)
30. **As staff**, I want contacts/matters to sync from Lawmatics so that Lawmatics remains CRM source of truth initially.

### I) Bounded AI assistance (optional, gated)
31. **As a client**, I want an AI interview option that fills the same structured fields so that I can complete the questionnaire faster.
32. **As an attorney**, I want issue-spotting flags/checklists (AI-assisted or rules-based) so that I don’t miss common risks.

## Stage 2+ — Expansion (later)
- **Maryland templates + rules** for the baseline packet.
- Deeper workflows per matter type (probate VA, trust admin, deeds).
- Replace/augment CosmoLex (by Jan 2027 decision point; likely QBO).
- Metricool replacement module (social scheduling + engagement reporting).
