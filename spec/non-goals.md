# Legacy Guardians — Non-goals

Version: v0.2
Date: 2026-03-05

## Global non-goals (explicit boundaries)
These are intentionally out of scope for Legacy Guardians to **replace** as first-class UIs, though integrations may exist.
- **Email UI**: Google/Gmail
- **Video conferencing UI**: Zoom
- **Credit card payment processing UI**: LawPay
- **File storage UI**: Dropbox
- **Phone system UI/call routing**: RingCentral / Zoom Phones; call tracking: CallRail

## Stage 1 non-goals (Virginia document assembly MVP)
Stage 1 is intentionally narrow: **VA document assembly + minimum operational scaffolding**.

Not in Stage 1:
- Replacing **Lawmatics** as the CRM source of truth.
- Full-featured practice management suite (tasks, full matter timeline, advanced automations) beyond what drafting requires.
- Full marketing platform replacement.
- Fully autonomous AI that drafts novel legal language outside approved templates/rules.
- Multi-jurisdiction support beyond **Virginia**.
- Deep workflows for probate/trust admin/deeds beyond basic matter tracking (Stage 1 supports matter types, but assembly focus is Estate Planning VA).

## Accounting/timekeeping non-goals (Stage 1)
- Full general ledger, bank feeds, reconciliations, and firm-wide bookkeeping.
- Replacing **CosmoLex** before the planned transition window (CosmoLex remains system of record through **Jan 2027**).

Note: **Trust accounting is NOT a non-goal**. LG must support minimum viable trust ledgering from day 1.

## Multi-location non-goals (Stage 1)
- Inter-company accounting for the MSO model (explicitly deferred / TBD).

## Not promised (until defined)
- **End-to-end encryption** as a blanket claim (requires a defined threat model and key custody decisions).
- Specific compliance certifications (e.g., SOC 2 Type II) by a specific date.
