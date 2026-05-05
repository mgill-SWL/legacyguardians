# Google Sheets KPI Layout (v1)

## Firm KPI spreadsheet
Spreadsheet ID: `1YDwUTqbgHNmAh7L3n8TDPYt35l6YgaSwmW3jZd_WOq0`

### Tabs
1. `raw_cosmolex_detail`
   - append/import raw normalized rows from `exports/kpis/cosmolex_kpi_detail.csv`
   - columns:
     - source_system
     - source_report
     - range_start
     - range_end
     - metric_date
     - metric_key
     - timekeeper
     - invoice_number
     - client
     - matter
     - matter_file_number
     - billed_fee_usd
     - collected_fee_usd
     - metric_value_usd

2. `attorney_kpi_snapshot`
   - one row per attorney
   - columns:
     - attorney_name
     - billed_7d_usd
     - billed_28d_usd
     - billed_30d_usd
     - collected_7d_usd
     - collected_28d_usd
     - collected_30d_usd
     - reviews_30d_count
     - attorney_score_30d_avg
     - attorney_score_all_time_avg
     - lead_conversion_30d_pct
     - lead_conversion_all_time_pct
     - new_cases_opened_30d
     - updated_at

3. `attorney_kpi_history`
   - snapshot history by sync date
   - same columns as snapshot plus `as_of_date`

## Employee spreadsheet (one per attorney)
### Tabs
1. `my_kpis`
   - single-row latest snapshot for that attorney
2. `my_history`
   - historical snapshots by sync date
3. `raw_my_detail`
   - optional detail rows filtered to that attorney only

## Aggregation rules (v1)
- `billed_7d_usd` = sum of `timekeeper_billed_usd` where `metric_date >= as_of_date - 6 days`
- `billed_28d_usd` = sum of `timekeeper_billed_usd` where `metric_date >= as_of_date - 27 days`
- `billed_30d_usd` = sum of `timekeeper_billed_usd` where `metric_date >= as_of_date - 29 days`
- `collected_7d_usd` = sum of `timekeeper_collected_usd` where `metric_date >= as_of_date - 6 days`
- `collected_28d_usd` = sum of `timekeeper_collected_usd` where `metric_date >= as_of_date - 27 days`
- `collected_30d_usd` = sum of `timekeeper_collected_usd` where `metric_date >= as_of_date - 29 days`
- `as_of_date` should default to the max imported report `range_end` for the current sync batch.

## Notes
- Financial KPIs should be sourced from CosmoLex imports first.
- Other KPI columns may remain blank until those sources are wired.
- Separate employee files avoid over-sharing firm-wide KPI data.
- Local build script for attorney snapshot output: `scripts/build_attorney_kpi_snapshot.py`
