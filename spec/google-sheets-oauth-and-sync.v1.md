# Google Sheets OAuth + Sync Design (v1)

## Goals
- Admin-connected **firm KPI** spreadsheet for firm-wide reporting.
- One **employee spreadsheet per attorney**, shared to that attorney's Google account.
- Weekly CosmoLex report uploads flow into normalized KPI rows, then sync into Google Sheets.

## OAuth scopes
Use the minimum workable scopes:
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/drive.file`

If explicit permission management proves necessary for sharing files to employees, add:
- `https://www.googleapis.com/auth/drive`

## Connection model

### GoogleConnection
Represents one Google OAuth connection.

Fields:
- `id`
- `user_id`
- `google_email`
- `google_subject`
- `access_token_encrypted`
- `refresh_token_encrypted`
- `token_expires_at`
- `scopes`
- `created_at`
- `updated_at`
- `revoked_at` (nullable)

### KpiSheetTarget
Represents a Google Sheet destination.

Fields:
- `id`
- `target_type` (`firm_admin` | `employee`)
- `owner_user_id` (nullable for firm-level shared target)
- `google_connection_id`
- `spreadsheet_id`
- `spreadsheet_url`
- `sheet_name_snapshot`
- `sheet_name_history`
- `sheet_name_raw_detail`
- `active`
- `created_at`
- `updated_at`

### AttorneyDirectory
Local mapping used for routing KPI rows.

Fields:
- `id`
- `display_name`
- `cosmolex_timekeeper_name`
- `employee_user_id` (nullable until account exists)
- `employee_google_email` (nullable until provided)
- `employee_sheet_target_id` (nullable until sheet created)
- `active`

## Sync pipeline

### Step 1: import reports
Input:
- uploaded CosmoLex weekly reports

Output:
- `exports/kpis/cosmolex_kpi_detail.csv`
- `exports/kpis/attorney_kpi_snapshot.csv`

### Step 2: sync firm sheet
Write/update tabs:
- `raw_cosmolex_detail`
- `attorney_kpi_snapshot`
- `attorney_kpi_history`

Behavior:
- replace `raw_cosmolex_detail` for the current sync batch
- replace `attorney_kpi_snapshot` with latest snapshot rows
- append one dated batch to `attorney_kpi_history`

### Step 3: sync employee sheets
For each attorney with a mapped `employee_sheet_target_id`:
- filter their rows from `attorney_kpi_snapshot`
- filter their rows from `raw_cosmolex_detail` if detail tab enabled
- replace `my_kpis`
- append/update `my_history`

## Spreadsheet creation flow

### Firm target
- Admin connects Google account.
- Existing spreadsheet ID is stored as the `firm_admin` target.
- Current known spreadsheet ID:
  - `1YDwUTqbgHNmAh7L3n8TDPYt35l6YgaSwmW3jZd_WOq0`

### Employee target
- Admin or employee initiates “create KPI sheet”.
- App creates spreadsheet named:
  - `Legacy Guardians KPI - {Attorney Name}`
- App creates tabs:
  - `my_kpis`
  - `my_history`
  - `raw_my_detail`
- App shares file to employee Google email.
- App stores returned `spreadsheet_id` + URL in `KpiSheetTarget`.

## Sync idempotency
- Each sync batch should have a stable `batch_id`.
- History rows should include `batch_id` and `as_of_date`.
- Re-running the same batch should not duplicate history rows.

## Open questions
- whether employee sheets are created using the admin connection or each employee’s own connection
- where OAuth tokens will live in the actual app stack once repo structure is confirmed
- whether firm sheet snapshot/history should be formula-driven or fully app-written

## Recommendation
For v1:
- use **admin connection** to create and populate both firm and employee sheets
- share employee sheets to employee emails as viewers or editors depending on workflow
- keep all KPI calculations app-side, not formula-side, for repeatability and auditability
- start with **attorney KPI sheets** for attorneys/timekeepers first; non-attorney employee sheets can be added once their KPI definitions are normalized

## Current roster captured
Stored in:
- `spec/employee-directory.csv`
- `spec/attorney-directory-template.csv`

Attorney roster currently identified for KPI sheet rollout:
- Michael Gill — `mgill@speedwelllaw.com`
- Alexandra Filiault — `afiliault@speedwelllaw.com`
- Arjan Grover — `agrover@speedwelllaw.com`
- Omer Ozusta — `omer@speedwelllaw.com`
