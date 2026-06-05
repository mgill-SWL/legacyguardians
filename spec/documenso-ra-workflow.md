# Documenso Representation Agreement Workflow

Status: first implementation pass, 2026-06-05.

## Product boundary

Documenso is for e-sign eligible documents only:

- Representation agreements
- HR documents
- Consents
- Authorizations
- Non-notary acknowledgements

Testamentary estate planning execution documents stay outside Documenso and continue to be signed in person.

## RA packet shape

The estate planning representation agreement packet should be generated as one PDF:

1. Customized estate planning proposal
2. Representation Agreement
3. Waiver of Potential Conflict of Interest, when a couple
4. Limited Power of Attorney, when deed/conveyance work is included
5. Exhibit A, Estate Planning Services and Prices
6. Exhibit B, Client Expectations Agreement

The fee quote builder is the source for the proposal table, selected service features, courtesy adjustments, and final custom fee quote.

## Token migration

Lawmatics text merge tokens should move to explicit LG data tokens during template migration. Examples from the current RA:

- `|current-date-month-day-year|` -> generated packet date
- `|full-name|` -> signer 1 full name
- `|{Spouse}full-name|` -> signer 2 full name
- `|email-primary|` -> signer 1 primary email, plus signer 2 email once modeled
- `|lead-attorney|` -> assigned lead attorney
- `|Prospect-Custom-Fee-Quote|` -> fee quote builder total
- `|Prospect-SERVICE-FEATURE-*|` -> fee quote builder line items

## Documenso signer placeholders

Documenso can detect PDF placeholders in the format `{{FIELD_TYPE, RECIPIENT}}`. Use these in the generated RA before PDF conversion:

- Lawmatics `[sig|req|signer1 ]` -> `{{signature, r1}}`
- Lawmatics `[date|req|signer1]` -> `{{date, r1}}`
- Lawmatics `[sig|req|signer2 ]` -> `{{signature, r2}}`
- Lawmatics `[date|req|signer2]` -> `{{date, r2}}`

Recipient order:

- `r1` = primary client / spouse 1
- `r2` = spouse 2

## API implementation notes

Legacy Guardians now has:

- `SigningPacket` model for provider envelope id, status, recipients, signing URLs, and provider response.
- `GET /api/documenso/status` for server-side API-token verification.
- `POST /api/documenso/envelopes` for creating a Documenso envelope from a PDF. It defaults to draft creation; `send=true` distributes the envelope.

Environment variables:

- `DOCUMENSO_API_TOKEN`
- `DOCUMENSO_API_BASE_URL` optional, defaults to `https://app.documenso.com/api/v2`.

Important constraint: Documenso does not convert DOCX to PDF. LG must render the RA packet to PDF before calling Documenso.
