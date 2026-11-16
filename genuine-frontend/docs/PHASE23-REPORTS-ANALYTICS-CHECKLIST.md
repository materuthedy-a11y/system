# Phase 23 — Reports & Analytics QA Checklist

This checklist records observed behavior and code-level fixes. A section is GREEN only after its stated checks pass; an implementation or type-check alone does not count as browser verification.

## 23.1 Access control and report routing

- [x] **23.1.1** `reports.view` protects report endpoints.
- [x] **23.1.2** A user without `reports.view` sees the access-required state and no report data/export controls; user confirmed no report request was sent.
- [x] **23.1.3** Direct `?tab=finance` opens Finance, and tab selection updates the URL. Fixed tab initialization race in `app/dashboard/reports/page.tsx`.
- [ ] **23.1.4** Recheck direct links and browser Back/Forward on desktop and mobile after the latest build is available.

## 23.2 Date ranges and grouping

- [x] **23.2.1** Last month: 01/10/2026–31/10/2026; zero period revenue, current inventory clearly disclosed as a live snapshot.
- [x] **23.2.2** This quarter: 01/10/2026–14/11/2026; weekly buckets.
- [x] **23.2.3** This financial year: 01/01/2026–14/11/2026; monthly buckets. Current setting uses the calendar year start.
- [x] **23.2.4** Custom range 01/11/2026–14/11/2026.
- [x] **23.2.5** Reversed From/To is rejected with one toast and no invalid report request/error panel.
- [x] **23.2.6** Overview quarterly and yearly grouping return the expected 2026-Q4 and 2026 buckets.
- [x] **23.2.7** Finance grouping is limited to Daily, Weekly, Monthly because the financial report API groups cash flow at those intervals.
- [x] **23.2.8** Daily Finance cash movement: inflows 5,313; outflows 1,700; closing net 3,613 TZS.
- [x] **23.2.9** Weekly Finance grouping reconciles to 3,611 TZS for the week beginning 02/11 and +2 TZS for the week beginning 09/11.
- [x] **23.2.10** Monthly Finance grouping reconciles to 5,313 inflows − 1,700 outflows = 3,613 TZS.
- [x] **23.2.11** Finance `asOf` date displays the selected business calendar date, not the next UTC day.
- [ ] **23.2.12** Test leap day, month/year boundaries, business timezone, and configured non-Monday week start.

## 23.3 Sales, returns, and receivables reconciliation

Test range: 01/11/2026–03/11/2026, grouped by Issue date.

- [x] **23.3.1** Invoice list supports both Invoice date and Issue date; selecting Issue date returns the seven issued invoices shown in the QA run. Backend date filtering and UI date label use the same basis.
- [x] **23.3.2** Gross invoice total: 25,724 TZS across 7 invoices.
- [x] **23.3.3** Accepted/received returns: 8,024 TZS; rejected returns are excluded.
- [x] **23.3.4** Net revenue: 25,724 − 8,024 = 17,700 TZS, matching the Overview and Sales reports.
- [x] **23.3.5** Sales-by-location totals reconcile: PH21 Test Branch 14,160 + Main Warehouse 3,540 = 17,700 TZS.
- [x] **23.3.6** Sales report uses positive balances for Outstanding (14,160 TZS) and excludes the 1,770 TZS customer credit from receivables.
- [x] **23.3.7** Added a separate Customer credits metric so the overpayment/return credit is visible instead of hidden in a negative invoice balance.
- [x] **23.3.8** Added regression coverage for accepted returns, overpayment credit, zero positive outstanding, and unpaid invoice count.
- [x] **23.3.9** Refreshed Sales report: Customer credits = 1,770 TZS, Outstanding = 14,160 TZS, and net positive receivable = 12,390 TZS; user confirmed the metric appeared.
- [x] **23.3.10** Browser values reconcile: revenue 17,700 TZS; location revenue 14,160 + 3,540 = 17,700 TZS; invoices 7; collections 5,310 TZS.
- [ ] **23.3.11** Test a fully refunded invoice, a return outside the selected period, and a payment received after the selected end date.

## 23.4 Exports and document presentation

- [x] **23.4.1** PDF code audit confirms Times-Roman with 12 pt table body, landscape pages, and wrapped long cells.
- [x] **23.4.2** Fixed PDF-only label sanitizing (`·` no longer becomes `?`), removed internal customer IDs from the Top Customers PDF table, added column padding/weighted widths, and padded multiline table rows so text stays inside its colored row backgrounds.
- [x] **23.4.3** Added page preflight so short Top Customers tables do not leave a single orphaned row on the next page.
- [x] **23.4.4** Executive Overview PDF now includes the visible summary, definitions, revenue/expense series, and Top Products table without the duplicate internal KPI catalogue; structured exports retain nested executive chart series.
- [x] **23.4.5** Added Sales Summary channel breakdown and grouped revenue trend to PDF, CSV, XLSX and JSON exports; UI grouping is preserved and rendered as readable labels.
- [x] **23.4.6** Cleaned Sales Summary trend exports to `Period` and `Revenue` only; removed raw end-of-day ISO timestamps, percent-change and moving-average fields that are not shown in the Sales report.
- [x] **23.4.7** Added regression coverage for two/three-customer pagination, executive chart-series retention, PDF labels, 12 pt Times-Roman text, visible overview sections, and Sales Summary data in all four formats.
- [x] **23.4.8** Fixed Executive Overview pagination: a 15-day report now fits the one-row Top Products section on the revenue page rather than emitting a nearly empty fourth page; short Sales customer tables also fit together.
- [x] **23.4.9** CSV regression verifies UTF-8 BOM, quoted/escaped values, CRLF records, and spreadsheet formula-injection prefix protection.
- [x] **23.4.10** XLSX regression opens the generated ZIP entries and confirms the channel/trend sheets contain the expected data without internal trend calculation fields; JSON regression checks the same values.
- [x] **23.4.11** Rendered the latest backend PDF output from representative executive and sales data: both use readable 12 pt Times-Roman tables, line backgrounds contain wrapped text, IDs are omitted from human-facing tables, and pagination is 3 pages for the current representative data.
- [x] **23.4.12** Re-exported Executive Overview PDF in the browser for 01/11–15/11: 3 pages; Key Figures, Report Details, Revenue and Expenses, and Top Products are present; Top Products is on page 3 with Revenue and Expenses, not stranded on a fourth page.
- [x] **23.4.13** Audited the browser-exported Sales Summary PDF: 3 pages; revenue 21,240 TZS reconciles to Top Customers (14,160 + 3,540 + 3,540), Sales By Channel (17,700 + 3,540), and daily revenue (17,700 + 3,540). Fixed null Growth Rate cells to display `—` instead of blank.
- [x] **23.4.14** User confirmed green on the re-exported Sales Summary PDF after the Growth Rate no-baseline marker was changed to `—`.
- [x] **23.4.15** Audited the downloaded Sales Summary CSV: UTF-8 BOM and CRLF are present; selected date/channel/grouping filters are included; revenue/customer/location/trend totals reconcile to 21,240 TZS. Found null Growth Rate exported as a blank cell and fixed null CSV values to render as `—`.
- [x] **23.4.16** Re-exported Sales Summary CSV for 01/11–15/11; both no-baseline Growth Rate cells display `—`.
- [x] **23.4.17** Verified newest download `sales_dashboard-2026-11-15 (1).csv`: UTF-8 BOM, CRLF, all four sections, date range, Location/Daily filters, and totals match the pasted CSV. The older same-name file without `(1)` is stale and still has blank Growth Rate cells.
- [x] **23.4.18** Audited the downloaded Sales XLSX package: one valid Report worksheet, all four sections, numeric cells retained as numbers, and totals match the CSV. Found null Growth Rate cells blank, default-width columns, and a frozen report-title row; fixed nulls to `—`, calculated readable column widths, and removed the inappropriate freeze pane.
- [x] **23.4.19** Verified the new Sales Summary XLSX for 01/11–15/11: all four sections are present, numeric cells remain numeric, Growth Rate shows `—` for both locations, columns have explicit readable widths, and revenue reconciles to Top Customers (21,240), Sales By Channel (21,240), and the daily trend (21,240). Quantity reconciles to 6 and channel profit to 9,240 TZS.
- [x] **23.4.20** Verified the new Overview XLSX for 01/11–15/11: no-baseline `Change Percent` values display `—` (expenses and inventory retain valid 0% comparisons), the one-sheet Report contains all Overview sections, numeric measures remain numeric, columns have explicit widths, and no frozen title row remains. Key figures reconcile: revenue 21,240; profit 9,240; cash 3,613; receivables 17,697; payables 6,127; inventory 774,200 TZS.
- [ ] **23.4.21** Open the latest CSV and both XLSX files in spreadsheet software and verify sections/columns render clearly.
- [ ] **23.4.22** Verify export permission separately from view permission, including direct API authorization.
- [ ] **23.4.23** Verify narrow-screen export controls and downloaded document readability.

## 23.5 Charts, loading, and responsive behavior

- [ ] **23.5.1** Check chart values against the underlying daily/weekly/monthly series, including zero-value and one-period ranges.
- [ ] **23.5.2** Check loading animation timing, reduced-motion preference, and no stale chart shown after changing tabs/ranges.
- [ ] **23.5.3** Check at mobile, tablet, and desktop widths in light and dark modes; verify tab scrolling, labels, tooltip access, and no clipped content.

## 23.6 Build and automated audit status

- [x] **23.6.1** Frontend TypeScript check: `pnpm run type-check` passed.
- [x] **23.6.2** Backend TypeScript check: `pnpm exec tsc --noEmit` passed.
- [x] **23.6.3** Backend Jest suite: 7 suites, 61 tests passed after the Product performance API and PDF export fixes.
- [x] **23.6.4** Backend Nest compile: `pnpm exec nest build` passed.
- [x] **23.6.5** Backend TypeScript and Nest compile pass after the PDF pagination, XLSX null-display/column-width, and Product performance changes.
- [x] **23.6.6** Frontend ESLint on the changed reports, sales-invoices, offline, PWA, and reports API files passed.
- [ ] **23.6.7** Visually verify the red disconnected-Wi-Fi icon in browser offline mode (code updated in `/offline`, offline fallback, and the PWA banner).
- [ ] **23.6.8** Latest full backend `pnpm run build` retry stopped at Prisma Client generation with Windows `EPERM` renaming the query-engine DLL held by another process; Nest compile was run afterward and passed.
- [ ] **23.6.9** Frontend production build: blocked by the repository's production config because `.env.production` still contains the placeholder API URL `https://api.your-domain.com/api/v1`. Set the actual HTTPS deployment URL before treating production build as verified.
- [x] **23.6.10** Latest pre-Supplier code checks: backend Jest 8 suites / 75 tests; backend/frontend TypeScript; Nest build; focused backend/frontend ESLint; and `git diff --check` passed. Later Supplier changes are recorded in 23.7.5 and the current verification status below.

## 23.7 Tab-by-tab data and export reconciliation

Use the same 01/11/2026–15/11/2026 range where the tab supports period filters. For each tab, compare the rendered report to its PDF, Excel, CSV, and JSON export. Mark a tab complete only after user-provided UI/export evidence is reconciled with the backend calculation and all four export payloads.

- [x] **23.7.1** Overview: key figures, definitions, daily revenue/expense series, top products, cash flow, and customer metrics reconciled across the latest PDF/CSV/Excel evidence; Excel no-baseline values display `—`.
- [x] **23.7.2** Sales: issued-invoice revenue, accepted returns, collections, positive outstanding/customer credits, customers, channel totals, and daily revenue reconciled; Sales PDF/CSV/Excel evidence checked.
- [x] **23.7.3 code audit** Product revenue applies invoice discount allocation and accepted returns; currentStock is timestamped; historic period stock is reconstructed from signed movement totals; days use unrounded turnover; return-period negative COGS is retained and non-positive-revenue margin is null; Product PDF uses compact headers and omits internal IDs while retaining SKU. New regression coverage added.
- [ ] **23.7.3.1** Browser: verify Product row fields, amount formatting, current-stock timestamp/disclosure, responsive table, and revenue/quantity/profit/margin rank choices.
- [ ] **23.7.3.2** Backend reconciliation: reconcile invoices, allocated discounts, accepted returns, sale/reversal/return COGS, current StockBalance and movement-derived opening/closing stock for 01/11/2026–15/11/2026. Include adjustments, purchases and cross-location transfers in the stock denominator; confirm later movements are backed out.
- [ ] **23.7.3.3** Edge cases: return-only product, returns against earlier-period invoices, negative net units/revenue/COGS, zero or negative revenue margin (`—`), zero stock, no movement, fractional quantities, and ties in every sort mode.
- [ ] **23.7.3.4** Latest CSV, Excel and PDF now include `inventoryAsOf` and metric definitions. All supplied formats agree on the product row: revenue 16,776 − COGS 12,000 = profit 4,776; margin 28.47%; turnover 0.06 rounded; estimated days 242.5 from unrounded turnover. JSON was not included in this upload; verify it preserves the same row, selected period and metadata.
- [ ] **23.7.3.5** PDF QA: the supplied PDF still overlaps SKU with Category. Product-column weights were corrected and the newly rendered code PDF was visually checked: SKU/category are separated; COGS and Days stay on one line; long product name wraps; headings and 12pt body remain readable. Re-export in the browser and confirm the downloaded file matches the corrected layout, with IDs absent and multi-page tables paginating correctly.
- [ ] **23.7.3.6** Unit-history gap: invoice line items currently do not store the unit label used when the transaction was saved. Confirm the sample's product base/default unit has not changed; decide whether historical unit snapshots and a migration are required before claiming historical unit labels are exact.
- [x] **23.7.4 code audit** Customer period revenue subtracts only accepted returns dated in the selected range; invoice count is recognized invoices issued in the range; last purchase is latest recognized invoice through period end. New/never-purchased active customers are included in percentile population, ties use midranks, and AOV is null without invoices. Response/export include period, as-of date, selected ranking and metric definitions; export drops pagination internals. UI now says “Rank customers by” and discloses metric scope. Customer PDF has compact headers, date-only last-purchase display and weighted columns; 4-format export regression coverage added.
- [x] **23.7.4.1** User-provided Customers view for 01/11/2026–16/11/2026 has 9 active accounts; sold rows sum to TZS 21,240 across 8 invoices (Alpha 14,160/6, Beta 3,540/1, PH22 3,540/1), matching the latest known Sales totals. AOVs reconcile (2,360; 3,540; 3,540), purchase dates and inactive days reconcile to 16/11 end date (13/13/12). Six accounts have no sales in the range.
- [ ] **23.7.4.1.1** The supplied screen/PDF still shows Loyalty Score 25% for customers with no purchase history, while current backend logic and metric definition set this to 0%. Restart/reload the latest backend, refresh Customer Analytics, and confirm the six no-history customers show 0% before accepting new exports; this is a stale-build/data mismatch, not a PDF formatting issue.
- [ ] **23.7.4.2** Change ranking Revenue, Purchase frequency, Loyalty and Recency; confirm ranking order, selected range, page reset when switching tabs/date ranges, pagination and empty state.
- [ ] **23.7.4.3** Reconcile a return-only customer, accepted return in selected period, prior-period purchase and no-invoice customer. Confirm return-only revenue may be negative, invoice count remains zero, AOV shows `—`, last purchase is not changed by a return, and inactivity is measured at selected end date.
- [x] **23.7.4.4 code/PDF render** Customer PDF suppresses redundant internal definitions, prints compact period/currency/ranking/as-of/active-count metadata, formats purchase dates as dates and loyalty values as percentages, removes internal IDs, uses readable 12pt landscape table columns and includes a metric guide. Rendered a representative nine-customer PDF: all nine rows fit together on page 1, names/codes/types/amounts/statuses do not collide or split mid-word, and definitions are readable on page 2.
- [ ] **23.7.4.5 browser export** Restart/reload the latest API, set 01/11/2026–16/11/2026 and Revenue ranking, export Customer analytics as PDF. Confirm the six no-history Loyalty Scores are 0%, no customer rows are missing, and the downloaded two-page PDF matches the rendered layout. Then inspect Excel, CSV and JSON separately for matching rows/metadata, no pagination fields, valid file structure and safe CSV.
- [x] **23.7.5 code audit** Supplier rows are business-scoped and retain inactive suppliers when they have qualifying history; PO cohort is selected by order date and excludes draft/cancelled orders. Accepted value prorates discounted PO line totals by accepted quantity (freight/tax/later returns explicitly excluded). Accepted/rejected/damaged values use processed GRNs by period end; whole rejected GRNs cannot inflate accepted stock. Missing expected dates are not assumed on time; expected-date coverage is shown, on-time/quality/lead-time are nullable without evidence, and risk becomes UNKNOWN when expected-date coverage is incomplete. Supplier export now includes period/as-of/currency/definitions, strips pagination internals, keeps supplier IDs in JSON for machine use but hides them in human-readable formats, and adds a compact metric guide to PDF.
- [x] **23.7.5.1 code test/PDF render** Regression covers discounts, partial rejects/damage, fully rejected GRNs, due-date eligibility, partial due-date coverage, no-GRN suppliers, null metrics, PDF/Excel/CSV/JSON export shape and spreadsheet package contents. Fixed the too-narrow Risk column and added supplier-only inter-column spacing; rendered a sample with 18.75% expected-date coverage and confirmed `UNKNOWN`, Coverage and the PDF headers no longer collide. Metric guide remains readable on page 2.
- [ ] **23.7.5.2 browser/source reconciliation** Restart/reload backend and verify the supplied 5-PO example against the five source POs and their processed GRNs; confirm accepted value after discounts, accepted/rejected/damaged quantities, expected-date coverage, risk and average first-GRN lead time. No source records were provided yet, so the screen's figures are not independently reconciled.
- [ ] **23.7.5.3 manual exports** Export the same supplier range as PDF, Excel, CSV and JSON. Confirm matching supplier rows/metadata/definitions, no page/limit fields, valid formats, readable PDF, numeric spreadsheet cells and no missing supplier IDs needed for your integrations.
- [x] **23.7.6 code audit** Seven Finance export selections have regression coverage across PDF, Excel, CSV and JSON; legacy SalesInvoice payment direction without invoiceId is consistent across cash flow, financial position and operational balance summary. Finance formulas, date/group controls and exports still require browser/source-data reconciliation.
- [ ] **23.7.7** Inventory: reconcile active products, stocked SKUs, quantities, valuation method/as-of timestamp, low-stock items, fast movers and location scope; confirm current snapshot is not presented as historical; verify all exports.
- [ ] **23.7.8** Trends & forecast: reconcile historical series and forecast input periods; verify each metric/method, confidence interval, minimum-history empty state, and trend/forecast PDF/Excel/CSV/JSON exports.
- [ ] **23.7.9** Cross-tab exports: confirm selected date range and tab parameters are preserved in filenames/content; CSV encoding/escaping, Excel numeric cells/widths, PDF readability/pagination, and JSON structure are correct.
- [ ] **23.7.10** Cross-tab integrations: confirm each selected tab calls its correct API/report type, owns loading/error/empty states, sends date/group/sort/segment/channel/forecast parameters, and cannot display stale rows/charts after switching tabs or ranges.

## 23.8 Audit history PDF/CSV

- [x] **23.8.1 code** Audit log offers PDF/CSV format and Applied filters/All events scope; PDF and CSV share backend date/action/type/search filters, tenant scoping, audit export permission and redaction. CSV summary declares totals and truncation; PDF identifies truncation. Focused tests pass.
- [ ] **23.8.2** Select PDF, Applied filters, From 01/11/2026 To 15/11/2026; Apply; confirm only matching events are downloaded and the inclusive dates appear in export metadata.
- [ ] **23.8.3** Select All events and confirm it ignores active filters; then repeat with CSV and compare event counts/content against the Audit Log list/export summary.
- [ ] **23.8.4** Verify redaction of password/token/session/private/access key/OTP/MFA/salt-like fields in before/after snapshots; verify IP and user agent are included only where recorded.
- [ ] **23.8.5** Exercise the 10,000-event cap. Both formats must state exact matching/exported counts; narrow date ranges to retrieve remaining rows. Confirm zero-event export, PDF page layout, and Excel/CSV import safety.
- [ ] **23.8.6** Verify `audit.export` permission and business isolation directly against API; ensure `audit.view` without `audit.export` cannot download and that failures do not generate a broken file.

## Current handoff

Phase 23 remains in progress. Overview and Sales evidence are accepted. Customer UI values provided by the user reconcile to 21,240 TZS and 8 invoices for 01/11–16/11, and recency days match the period end. Fixed a zero-score tie issue: customers with no purchase history now receive loyalty score 0 (instead of 25%); this is covered by the current passing regression suite but must be confirmed after refresh. Next browser step: refresh Customers, then export PDF, Excel, CSV, JSON from the same 01/11–16/11 Revenue ranking and provide the files. Audit export **23.8** is code-implemented but still needs browser/API download pass. General export visual checks, authorization, responsive behavior, chart/loading checks, offline icon and production build configuration remain open.
