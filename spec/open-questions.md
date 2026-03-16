# Legacy Guardians — Open questions

Version: v0.2
Date: 2026-03-05

Decisions already made (not questions): Stage 1 = **Virginia**, Stage 2 = **Maryland**; portal auth = **magic link**; trust accounting required day 1; Lawmatics CRM source of truth initially; billing/accounting pushed to CosmoLex through Jan 2027.

## A) Stage 1 (VA) assembly packet details
Decisions captured:
1. **Templates:** one base template set provided by the firm (docx). Attorneys should be able to customize templates for personal preference.
2. **Clause logic inventory:** yes, provide a rules inventory (conditions → clauses/variants) per document.
3. **Will selection rule (firm-wide):** if the packet includes a living trust, the will is a **pour-over** will. Standalone will means **no trust package**.
4. **Deed into trust:** deed assembly must include legal description extraction from prior deed upload, with **human-in-the-loop confirmation** and formatting rules.
5. **Formatting invariants:** default body style is **12pt Times New Roman** with **1" margins**; signature line formatting must be immaculate; will + trust require page-by-page **initial lines**; footers/headers need careful control.

Remaining open questions:
6. **Style stability:** define a “template hygiene” checklist + tooling to ensure docx styles stay stable and don’t introduce formatting artifacts (see note in our next review).

## B) Data model (households/relationships)
Decisions captured:
7. **Joint vs reciprocal UX:** present a unified “mirrored” plan; allow member-specific distribution wishes.
8. **Summary of Client Information:** required assembled document that shows contact details, family circumstances, fiduciary selections (instrument-level), and distribution scheme (specific + residual).
9. **Relationship graph scope:** include people with a legal right to inherit; step-children maybe; ex-spouses no. Fiduciary roles displayed in the summary.
10. **Funding model:** use the “magic wand” approach (Schedule A is generic); Declaration of Trust + tangible assignment fund broadly, with retirement account carve-out.

Remaining open questions:
11. **Structured distribution scheme:** what fields are needed to represent specific gifts vs residual shares deterministically across joint/reciprocal variants?
    - Captured (2026-03-11): residual distribution schemes include standard age-staged (NI/ROW milestones) and bloodline trust (replaces residual clause). Support NI@21 + ROW@25, unified @25, ROW split 25/30, split 25/30/35, and UHNW delay to 40.
    - Captured (2026-03-11): staged ROW schedules (e.g., 25/30/35 thirds) are deliberately **child-level only** by default; remote descendants are generally less restricted (non-UHNW coaching principle) to avoid elongating trustee administration.
12. **Beneficiary/descendant modeling:** how to represent per-stirpes/per-capita, contingent beneficiaries, charities, and special cases in a normalized way.
    - Captured (2026-03-11): strong preference to coach **per capita at each generation** as a residual scheme when there are 3+ children (always raised at 4) to keep generational fairness and avoid branch-size distortions.

## C) Trust accounting (Day 1 required) — remaining open questions
Already decided:
- Must maintain **client-level balances** and prevent negative balances.
- Must support receipts, disbursements, transfers, bank fees/charges, earned-fee transfers, adjustments/voids.
- **Three-way reconciliation is required.**
- LG should **push trust transactions** to CosmoLex during the interim period.

Open questions:
9. **Regime specifics:** Virginia IOLTA rules are in force (Rule 1.15 + Paragraph 20). Monthly three-way reconciliation and lawyer approval are required.
10. **Dimensions:** What dimensions are required on each trust transaction (matter, client/household, trust bank account, category/purpose, location, responsible attorney, etc.)?
11. **Approvals:** **Dual control is required** (maker/checker), at least for reconciliations and high-risk actions (voids/backdates, trust→operating transfers).
12. **Reconciliation cadence:** Monthly is required; do you also want on-demand reconciliation runs (e.g., before large disbursements)? Do you reconcile per trust bank account?
13. **LawPay deposit ingestion:** What format do you have for daily deposit reports, and do you want automated import on day 1 or manual upload + mapping first?

## D) Integrations
14. **Lawmatics sync scope:** Which objects are synced day 1 (contacts, matters, pipeline stages, custom fields)? One-way or two-way?
15. **CosmoLex push method:** What is the preferred mechanism (API, CSV import, manual export)? What fields are required?
16. **Dropbox:** Is Dropbox the system of record for documents immediately, or does LG store drafts/outputs and then sync/publish?

## E) Multi-location model
17. **Location definition:** Confirm that “location” = regional owner; how are multiple offices represented for address/letterhead selection?
18. **Matter transfers:** What business rules apply when transferring a matter (reporting attribution, permissions, billing destination)?

## F) Data retention and immutability
19. **Executed docs + notes:** Where do attorney notes live (LG vs external), and how do we ensure “never delete” while still supporting corrections (append-only)?
20. **Retention clock:** When does the 5-year timer start for matter metadata (close date, last activity, creation)?

## G) Stage 2 (Maryland)
21. **MD packet definition:** Confirm exact MD document list and any additional state-specific docs.
22. **Variation management:** How should the system model and test state-specific variants (VA vs MD) without template sprawl?

## H) Future module: Metricool replacement
23. **Requirements:** What minimum capabilities are expected (post scheduling, cross-platform publishing, engagement reporting, team workflows)?
