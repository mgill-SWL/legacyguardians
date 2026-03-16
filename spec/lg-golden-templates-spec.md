# Legacy Guardians – Golden Templates Development Spec

## Goal
Create "golden" estate-planning document templates that Legacy Guardians (LG) can use natively to assemble drafted estate plans from LG forms + attorney selections.

## Tooling / Current Process
- **HotDocs** is used **only** to help *author* the initial golden templates.
- **HotDocs is not intended** to be the production assembly engine.
- Production assembly is envisioned as LG using a chosen **LLM model** to generate a **.docx** using LG data + template structure.

## Placeholder / Field Convention
- Template fields that LG will fill should use bracket placeholders:
  - `[[FieldName]]`
- Adopt party naming convention:
  - `Client1...` / `Client2...` (preferred over Spouse1/Spouse2)

## Notes
- Keep placeholders distinct and unlikely to collide with normal prose.
- Prefer atomic fields where helpful (e.g., `[[Client1FirstName]]`, `[[Client1LastName]]`, `[[Client1FullName]]`).
