# KPI Schema (v1)

## Entities
- **Timekeeper**: attorney/employee who bills time (keyed by `cosmolex_timekeeper_id` or exact Cosmolex display name)
- **Window**: trailing windows use **inclusive** date ranges ending on report "as-of" date
  - 7d = last 7 days
  - 28d = last 28 days ("4-week")
  - 30d = last 30 days
  - all_time = entire dataset

## Financial productivity (CosmoLex source)
Source reports (current manual):
- Financial Productivity Report → **Collections by Timekeeper**
- (Add) Financial Productivity Report → **Billings by Timekeeper** (or closest CosmoLex equivalent)

### Metrics
All amounts are **USD**.

#### timekeeper_collected_usd
- Definition: payments actually received (cash collected), attributed by timekeeper per CosmoLex report.
- Windows: 7d, 28d, 30d

#### timekeeper_billed_usd
- Definition: billed amounts attributed by timekeeper per CosmoLex report.
- Windows: 7d, 28d, 30d

## Non-financial KPIs (placeholders)
These require additional sources to be wired later.

### 5-star reviews
- timekeeper_5star_reviews_count: 30d (and optionally all_time)
- Source TBD (Google Business Profile / other)

### Attorney score (Document Execution Checklist)
- attorney_score_avg_30d
- attorney_score_avg_all_time
- Source: Legacy Guardians checklist events

### Lead conversion
- lead_conversion_pct_30d
- lead_conversion_pct_all_time
- Source: intake/CRM pipeline events

### Case load
- new_cases_opened_30d
- Source: matter open events

## Ingestion formats (v1)
We expect **CSV export uploads** (or copy/paste blocks) from CosmoLex reports.
- Required fields to map: timekeeper name/id, period start/end (or as-of date + window), amount.

## Output targets
- Firm KPI Google Sheet (admin-only): spreadsheetId `1YDwUTqbgHNmAh7L3n8TDPYt35l6YgaSwmW3jZd_WOq0`
- Per-employee KPI Google Sheets (shared to employee email): create new spreadsheet per employee and write only that employee’s rows.
