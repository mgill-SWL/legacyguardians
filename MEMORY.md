# MEMORY.md — Long‑Term Memory

## Drafting / document set continuity
- Intake has a separate matter type: **Incapacity Documents Only** representation; also want ability to generate **single-document** outputs (e.g., only POA, only Advance Medical Directive) when needed. Default Incapacity Docs packet may include Final Disposition; questionnaire should be slimmed down vs full EP. (2026-03-11)
- Canonical document set likely already includes: Arbitration Clause; Blank Exhibit B; Blank TPP Insta; Cessation of Oral Nutrition and Hydration Directive; Crypto Fiduciary Powers; Residual Distribution Clause (principal & income at 25) — possible variant is net income at 21 with principal withdrawal starting at 25; and Special Distributions Provision (Long Form). (2026-03-11)

## Bloodline trust distribution scheme (remainder/residuary)
- Bloodline trust distribution scheme **replaces the residual distribution clause**; it’s a multi-generation approach for holding the rest, remainder, and residue to benefit descendants. (2026-03-11)
- Common timing patterns for net income (NI) + rights of withdrawal (ROW):
  - NI @ 21 + ROW @ 25 (typical)
  - NI + ROW unified @ 25
  - ROW split: 25/30 (equal halves) or 25/30/35 (thirds; usually the max unless UHNW)
  - UHNW: may delay ROW to 40
- Distribution philosophy note: prefers **per capita at each generation** as a residual distribution scheme when there are 3+ children (always raised at 4 children) to keep generational fairness and avoid birth-order/branch-size distortions. (2026-03-11)
- Docs received (stored in repo): Blank Land Trust Agreement (rare asset-protection option; legacy formatting issues), Residual Distribution Clause – Bloodline Trust, and Residual Distribution Clause – NI@21 + ROW 1/2@25 + 1/2@30. (2026-03-11)
- Clarification: prior EPP amendment clauses labeled "distribution" (not "residual distribution") were still intended to populate Article 6 distribution sections; 1/3 25/30/35 follows same structure as 1/2 25/30 with adjusted proportions + one extra sentence. (2026-03-11)
- Clarification/coaching: staged ROW restrictions like 25/30/35 "thirds" are intended **only at the child level**; for non-UHNW clients, prefer keeping grandchild-level distributions less restrictive to avoid extending trustee administration burdens (“ease off the throttle” for grandkids). (2026-03-11)
- Wealth-band coaching note: user starts “thinking differently” around **$7–10M** household/net worth as a practical threshold (comfortable income-off-principal), even though that’s not necessarily industry “UHNW” and not necessarily a taxable estate. (2026-03-11)
- TFM preference: trust funding memorandum should be a **portal-friendly web report** with **Word export**, visible to clients pre-signing and provided as hard copy at signing. (2026-03-11)
- Waiting on: template bloodline trust distribution language details as needed, and (if missing) delayed principal withdrawal arrangements; coaching prompts likely deferred until UI exists and a dedicated coaching agent is trained. (2026-03-11)

## Branding colors
- **“Speedwell law blue”** = `#3F64AE`. (2026-05-13)
- **Legacy Guardians primary blue** = `#2E4A7F`. (2026-05-13)
- Legacy Guardians brand kit direction: Concept D shield is only for app icon/favicon/manifest icons; Concept C arch mark/lockups are the visible in-app logo. Prefer SVG and use light/dark variants based on theme. (2026-05-13)

## Vercel deployment notes
- Vercel project Root Directory confirmed as `web/`. (2026-05-09)
- Vercel environment variable *names* inventory captured (values not stored) in `memory/2026-05-09.md`. (2026-05-09)
- GitHub push to `main` triggers Vercel auto-deploy; successful auth fix deployment observed for commit `e54c431` on 2026-05-20.

## Bookkeeping / KPI architecture
- Strategic product direction: Legacy Guardians should become the bookkeeping source of truth rather than CosmoLex; bank/card feeds or CSV imports plus in-app categorization/review should drive normalized financial events. CosmoLex becomes reconciliation/supporting input. (2026-05-05)
- KPI architecture should use upstream DB-backed financial events/bookkeeping feeding KPIs, with Google Sheets as reporting output only. (2026-05-05)
- `Trust to General Transfer` / trust-to-operating transfers count as **collection events** for KPI/business purposes, even if bookkeeping models them as transfers between trust and operating. (2026-05-05)
- Attorney revenue / collected-revenue KPIs count only `4100:Fee Income`; `4200` and `4250` should be tracked separately and excluded. Refunds should reverse KPI credit in the period when the refund occurs. (2026-05-05)
- Invoice Payment Allocations are the key operating-side source for KPI recognition because they bridge applied date, amount, matter owner, invoice, client-matter, source of funds, and account-level decomposition. Working rule: use Applied Date as collected-KPI recognition date and count only the `4100` portion. (2026-05-05)
- Operating Retainer By Matter should be treated as a liability-ledger source; negative balances likely indicate over-application / deficit at the operating-retainer liability level. (2026-05-05)
- Credit-card processor deposits can bundle multiple matters. Deposits are manually transcribed into CosmoLex and reconciled later; processor fees are not netted from each deposit and instead hit separately once monthly near the beginning of the month. (2026-05-05)
- Bookkeeping priority decision: start with **Operating vendor checks** (check register + match-to-bank outflows) before P&L. Withdrawal by check should support "To be printed" checked by default; if unchecked, user manually enters digits. If checked, assign next check number per bank account at print time, not save time. (2026-05-18)
- Known account setup notes: Burke & Herbert operating; South State money market checking has its own check stock and check-number sequence; South State line of credit and credit card need liability-side running balances. (2026-05-18)

## Billing / invoicing
- User wants **timekeeping + invoicing + A/R in Legacy Guardians**, not CosmoLex. (2026-05-08)
- Flat fees should be captured at the **timecard/time-entry level** with `pricingMode=FLAT`, amount set on the entry, and duration `0.0` (example: "Will Base Price" = $2,800). (2026-05-08)
- Invoice numbering should include a **4-character firm slug prefix** (e.g. `SWL`) and number invoices **per firm per year**. (2026-05-08)
- Task billing categories should be **billable**, **billed**, **non-billable**, and **no charge**. Billable tasks require a linked matter before completion. Completing a billable task should eventually prompt Billing Assistant/GPT to suggest narrative, duration/time, classification, billing code/category, and flag vague/risky narratives; assignee reviews/edits/approves to create a draft timecard. (2026-05-19)

## Firm / MSO model
- Reserved MSO firm slug: **LG**; not yet created as a Firm. (2026-05-08)
- Merrifield should be a **FirmLocation**, not a separate Firm; want P&L by location. Expected location assignment: Misha + Noah -> Alexandria; Arjan -> Merrifield. MSO is also a location for attribution. (2026-05-08)
- Firm owners are **person-only**; ownership changes are effective-dated with percentages. (2026-05-08)
- MSO model needs an effective-dated firm-level revenue split to Legacy Guardians: 0% for SWL, around 15-30% for some future firms. Split base should be net after refunds/chargebacks and exclude advanced client costs. Default payment allocation should be advanced-client-costs-first. (2026-05-08)

## Matter OS / CRM
- Native GPT-like agents should appear in the left nav as **Assistants**. (2026-05-19)
- Matter operating-system needs: custom matter fields as admin settings; fields populated from forms; matter timeline; manual action logging with types Phone call/Text/Email/Meeting/Internal note/Other; automation scheduled/run events should appear in timeline. (2026-05-19)
- Custom matter field types wanted: text, long text, date, currency, number, True/False, picklist, multi-select picklist, user/staff member, contact/person, and likely Lawmatics-style lookup relationship to another object/record. (2026-05-19)
- Contacts should cover professional advisors/general contacts, not just clients/vendors/referrers. Financial advisors are a major referral source. Professional/referral contact fields include type, referral source status, relationship owner, and matter referral source contact. (2026-05-19)
- Dashboard intake reporting should show the number of **document tours held**; intake sheet sync should recognize Doc Tour(s) Held and Document Tour(s) Held. (2026-05-20)

## Scheduling / automations
- Discovery call appointment type should be phone-call only, not Zoom. Other appointment types may use Zoom/calendar invite integration. (2026-05-20)
- Always send a calendar invite for booked appointments, including discovery calls. Discovery-call calendar invites should say Speedwell will call the client and should not include a Zoom link. (2026-05-20)
- Message template permissions: any signed-in user with an active firm should be able to create/update email/text message templates; deletion remains admin-only. (2026-05-20)
- Future `@speedwelllaw.com` users should auto-join Speedwell with an active firm via NextAuth `createUser`; live Christopher blockage was caused by `activeFirmId: null`, no `FirmMember`, and an empty Speedwell `MessageTemplate` table. (2026-05-20)

## Security / access
- One-time links should use unguessable tokens and expire automatically after 30 days from issuance/creation. Optional issuer-selectable TTLs may be 7/14/21/30 days. Resend/refresh should issue a new token and revoke the prior unused token. (2026-05-10)
- Extend-on-click for one-time links is acceptable only if the link is not yet used/completed, with a hard max-age cap of 90 days, rate limits, audit logging, and explicit UX. (2026-05-10)
- Misha wants Noah, Christopher, Arjan, and Jheny to be able to work with Nelson directly with roughly one approval per day from Misha, or when they specifically ask for Misha's approval for sensitive actions like pushing commits. Gateway-protected Discord allowlist/approval config must not be bypassed. (2026-05-20)

## Template rendering
- Notary sections across all documents need to be wired so they can change based on attorney-user input, likely via template tokens/conditionals instead of hardcoded blocks. Extra blank underlines in notary blocks likely come from literal Word content adjacent to empty token output. (2026-05-15)
- `renderTemplate.ts` sanitizes Word XML before docxtemplater render: fixes some unclosed tokens like `[[TOKEN],`, strips remaining Jinja tags/vars, uses docxtemplater delimiters `[[...]]`, and returns `""` for missing tokens. (2026-05-15)
