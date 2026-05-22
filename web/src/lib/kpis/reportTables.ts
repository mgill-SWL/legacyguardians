import type { ReportSheetColumn } from "@/lib/kpis/syncReportSheet";

export const L10_REPORT_SLUG = "exec-team-kpis";
export const TIMEKEEPER_REPORT_SLUG = "timekeeper-kpis";

export const L10_REPORT_COLUMNS: ReportSheetColumn[] = [
  { key: "month", label: "Month", type: "TEXT" },
  { key: "ep_new_onboarded", label: "# EP new onboarded", type: "NUMBER" },
  { key: "other_cases_onboarded", label: "# Other cases onboarded", type: "NUMBER" },
  { key: "total_onboarded", label: "Total", type: "NUMBER" },
  { key: "ep_pre_design", label: "EP Cases Pre-Design Meeting", type: "NUMBER" },
  { key: "ep_pre_doc_tour", label: "EP Cases Pre-Doc Tour", type: "NUMBER" },
  { key: "ep_concluded", label: "EP Cases Concluded", type: "NUMBER" },
  { key: "monthly_collections", label: "Monthly Collections", type: "CURRENCY" },
  { key: "ep_case_revenue", label: "EP Case Revenue", type: "CURRENCY" },
  { key: "other_case_revenue", label: "Other case revenue", type: "CURRENCY" },
  { key: "avg_ep_case_value", label: "Average EP Case Value", type: "CURRENCY" },
  { key: "avg_other_case_value", label: "Average Other Case Value", type: "CURRENCY" },
  { key: "lawpay_trailing_30_volume", label: "Lawpay trailing 30 day volume", type: "CURRENCY" },
  { key: "lawpay_past_30_avg_tx", label: "Lawpay past 30 days avg trx value", type: "CURRENCY" },
];

export const TIMEKEEPER_REPORT_COLUMNS: ReportSheetColumn[] = [
  { key: "month", label: "Month", type: "TEXT" },
  { key: "timekeeper", label: "Timekeeper", type: "TEXT" },
  { key: "new_matters_opened", label: "New matters opened", type: "NUMBER" },
  { key: "ep_matters_opened", label: "EP matters opened", type: "NUMBER" },
  { key: "fees_billed", label: "Fees billed", type: "CURRENCY" },
  { key: "fees_collected", label: "Fees collected", type: "CURRENCY" },
  { key: "five_star_reviews", label: "5 Star Reviews", type: "NUMBER" },
  { key: "welcome_calls_held", label: "Welcome Calls Held", type: "NUMBER" },
  { key: "design_meetings_booked", label: "Design Meetings Booked", type: "NUMBER" },
  { key: "welcome_call_conversion", label: "Welcome Call Conversion", type: "PERCENT" },
  { key: "avg_case_value", label: "Avg Case Value", type: "CURRENCY" },
  { key: "clx_matter_timeliness", label: "CLX Matter Timeliness (1-3)", type: "NUMBER" },
  { key: "clx_task_timeliness", label: "CLX Task Timeliness (1-3)", type: "NUMBER" },
  { key: "lm_pipeline_timeliness", label: "LM Pipeline Timeliness (1-3)", type: "NUMBER" },
];
