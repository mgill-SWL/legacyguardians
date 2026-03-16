# MVP Spec: Deterministic Portfolio DOCX Assembly — Couple (Joint Trust Packet) + Minor Children

## Why “slice” at all?
Even if the end-user experience is “generate the whole portfolio,” engineering still benefits from an MVP vertical slice:
- limits the number of moving parts while we prove deterministic DOCX rendering end-to-end
- reduces token dictionary scope so we can make it *correct* and testable
- creates a repeatable regression test fixture (template + JSON + expected output checks)

In this MVP, the *output* can still be a **single portfolio .docx**; the “slice” is about controlling scope, not forcing attorneys to generate docs one-by-one.

## MVP objective
Given matter data (JSON) and the current canonical portfolio template, LG generates a drafted **portfolio `.docx`** deterministically (no free-form LLM drafting), with:
- placeholder replacement
- loop/children support (limited)
- a missing-token report

## Template
- Use: `templates/canonical/joint.docx`
- Note: This file is treated as the **portfolio** template (trust + will + POA + AMD, etc.).

### Trust document must include (within the portfolio)
- Main joint revocable trust text
- Trustee powers
- Exhibit A
- Initial trust funding schedule

### Trust items optional / omit for MVP
- Exhibit B (specific gifts of cash/percentages) may be omitted for MVP

### Ancillary documents to omit for MVP
(These assist function/funding but are not part of the trust document itself.)
- Certification of trust
- Assignment of tangible personal property
- Declaration of trust

## Minor children
- Include children data in the matter schema and support rendering children references.
- Guardian nominations live in the **Will** (not the trust). Since the canonical template is a portfolio, this is in-scope to the extent the Will in the portfolio contains guardian nominations.

## Rendering approach
Deterministic rendering is preferred:
- Token replacement for `[[TokenName]]`
- Limited children support (MVP):
  - either (A) pre-expanded numbered child tokens (`[[Child1FullName]]`, `[[Child2FullName]]`, … up to N), or
  - (B) a very small loop DSL (preferred long-term), but only if it does not materially delay MVP

Key requirement: Word formatting must be preserved and tokens must be found even when split across runs.

## Data model (minimum)
- `clients[0]` (Client1) + `clients[1]` (Client2)
- `children[]` list (0..N)
- `matter.execution_date`
- `trusts[0].name`
- plus whatever the canonical template requires for addresses, counties/cities, signatures, etc.

## Outputs
- A single drafted `.docx` portfolio export
- A machine-readable “render report”:
  - tokens encountered
  - tokens resolved
  - tokens unresolved

## Acceptance criteria
- Portfolio doc opens cleanly in Word.
- All required tokens for the MVP scope resolve.
- Any unresolved tokens are reported.
- Children rendering works for 0, 1, 2, 3+ children cases (even if the formatting is simple in MVP).

## Future (not MVP)
- Additional rendering backend for client portal previews and consistent final PDFs (e.g., Jinja/HTML → PDF), while keeping DOCX as attorney-native editable output.
