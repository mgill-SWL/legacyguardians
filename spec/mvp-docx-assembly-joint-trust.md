# MVP Spec: Deterministic DOCX Assembly (Option 1) — Joint Revocable Trust

## Objective
Deliver an MVP document assembly pipeline inside Legacy Guardians (LG) that:
- takes structured matter data (JSON)
- takes a canonical golden template DOCX for a joint revocable trust
- outputs a drafted `.docx` with placeholders filled deterministically

This MVP is *non-LLM* for text generation: no free-form drafting. The system only fills predefined placeholders.

## Inputs
### 1) Template
- Canonical template: `templates/canonical/joint.docx`
- Placeholder syntax: `[[TokenName]]`
- Naming convention: `Client1...`, `Client2...` (not Spouse1/Spouse2)

### 2) Data
A single JSON payload representing a matter, e.g.:
```json
{
  "clients": [
    {"name": {"first": "Alice", "last": "Smith", "legal_full": "Alice Smith"}},
    {"name": {"first": "Bob", "last": "Smith", "legal_full": "Bob Smith"}}
  ],
  "trusts": [{"name": "The Alice and Bob Smith Revocable Trust"}],
  "matter": {"execution_date": "2026-03-15"},
  "firm": {"name": "Speedwell Law, PLLC"}
}
```

## Token dictionary
- LG should maintain a canonical token dictionary (the set of allowable tokens), with:
  - token key: `[[Client1FullName]]`
  - value resolver: a deterministic path/expression into the JSON

Existing drafts live in `data/token_mapping_*.yml` and should be normalized/curated.

## Rendering approach (deterministic)
### Must-have (MVP)
- Replace all tokens `[[...]]` found in document body + headers + footers.
- Preserve Word formatting.
- Provide a report of:
  - tokens found
  - tokens replaced
  - tokens missing (no value)

### Recommended implementation detail
Use a DOCX templating library that operates on the Word XML safely (rather than naive string replace across the zipped XML), e.g.:
- JS: docxtemplater
- Python: docxtpl

If implementing with raw XML replacement, handle tokens that may be split across `w:t` runs.

## Output
- A generated file saved to `exports/` (or equivalent), e.g.:
  - `exports/JointRevTrust_AliceSmith_BobSmith_2026-03-15.docx`

## Acceptance criteria
- Given a sample JSON + the canonical joint trust template, LG can produce a `.docx` where:
  - all required tokens resolve
  - unresolved tokens are reported (not silently ignored)
  - document opens cleanly in Word (no corruption)

## Next slice (post-MVP)
- Add conditional sections (minors / guardians, etc.)
- Add loop constructs (children list) via a limited templating DSL
- Add attorney review markers
