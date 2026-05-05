# KPI Upstream System Plan (v1)

## Core correction
Google Sheets should be treated as a **reporting/output layer**, not the primary system backbone.

Also: CosmoLex should not be the long-term source of truth for bookkeeping classification.
Legacy Guardians should become the source of truth, with bank/card imports + in-app review driving normalized financial events.

The real pipeline should be:
1. **Lead created**
2. **Lead converts to hired matter**
3. **Fee agreement / invoice / retainer recorded**
4. **Money deposited to trust or operating**
5. **Bookkeeping state updated**
6. **Attorney / staff KPIs computed**
7. **KPI UI + Google Sheets sync**

## What already exists in the app
From the current Prisma schema, Legacy Guardians already has a strong upstream base for:
- users / firms / locations
- contacts
- CRM contacts and tasks
- matters
- pipelines and stages
- Google connections

That means we should build KPI reporting **downstream of matters + payments**, not from ad hoc spreadsheets.

## Recommended build order

### Phase 1 — Revenue event foundation
Add canonical records for money movement and attribution.

#### Proposed models

### BillingAccount
Represents a bookkeeping bucket for a firm.

Fields:
- `id`
- `firmId`
- `name`
- `accountType` (`TRUST`, `OPERATING`, `AR`, `REVENUE`, `OTHER`)
- `externalSource` (`COSMOLEX`, `MANUAL`, `OTHER`)
- `externalId` nullable
- `active`

### MatterFinancialEvent
Canonical financial event log tied to a matter.

Fields:
- `id`
- `firmId`
- `matterId`
- `eventType` (`BILLED`, `PAYMENT_RECEIVED`, `TRUST_DEPOSIT`, `TRUST_APPLIED`, `OPERATING_DEPOSIT`, `REFUND`, `WRITE_OFF`, `TRANSFER`)
- `eventDate`
- `amountCents`
- `currency` default `USD`
- `sourceSystem` (`COSMOLEX`, `MANUAL`, `IMPORT`)
- `sourceReportType` nullable
- `sourceReference` nullable
- `notes` nullable
- `importBatchId` nullable
- `createdByUserId` nullable
- `createdAt`
- `updatedAt`

### MatterFinancialAttribution
Attribution rows for who gets credit for a financial event.

Fields:
- `id`
- `financialEventId`
- `userId` nullable
- `displayName`
- `attributionRole` (`LEAD_ATTORNEY`, `TIMEKEEPER`, `INTAKE_OWNER`, `ORIGINATOR`, `OTHER`)
- `amountCents`
- `percentageBps` nullable

This lets one payment split across multiple timekeepers.

### KpiImportBatch
Tracks uploaded/imported source files.

Fields:
- `id`
- `firmId`
- `sourceSystem` (`COSMOLEX`)
- `reportType` (`COLLECTIONS_BY_TIMEKEEPER`, `BILLINGS_BY_TIMEKEEPER`)
- `rangeStart`
- `rangeEnd`
- `uploadedByUserId`
- `sourceFilename`
- `status` (`PENDING`, `IMPORTED`, `FAILED`)
- `errorMessage` nullable
- `createdAt`
- `updatedAt`

## Phase 2 — KPI query layer
Once the financial events exist, compute KPIs from the database rather than directly from CSVs.

### Attorney financial KPIs
- billed 7d / 28d / 30d
- collected 7d / 28d / 30d
- trust deposits received 7d / 28d / 30d
- trust-to-operating/general transfers counted as **collected**
- optionally: operating deposits 7d / 28d / 30d

### Intake / conversion KPIs
Use CRM + matter conversion records for:
- lead conversion 30d / all time
- consult-to-hire conversion
- show rate / no-show rate

### Operations KPIs
Use matter lifecycle state for:
- caseload
- new cases opened 30d
- documents generated / signed

## Phase 3 — UI

### Admin pages
- `/admin/kpis`
- `/admin/imports/cosmolex`
- `/admin/bookkeeping`

### Employee pages
- `/me/kpis`

## Phase 4 — Google Sheets output
Only after DB-backed KPIs are stable:
- sync firm KPI sheet
- sync per-attorney KPI sheets

## Why this is better
- avoids KPI logic being trapped in spreadsheets
- lets bookkeeping become auditable and queryable
- supports future dashboards, bonuses, reports, and reconciliations
- makes Google Sheets disposable output rather than the source of truth

## Immediate next step recommendation
The next implementation slice should be:
1. add `KpiImportBatch`
2. add `MatterFinancialEvent`
3. add `MatterFinancialAttribution`
4. build admin CosmoLex upload/import flow into those tables
5. compute attorney billed/collected KPIs from DB
6. then wire the UI and Sheets sync
