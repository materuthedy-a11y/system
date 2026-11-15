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

## 23.7 Tab-by-tab data and export reconciliation

Use the same 01/11/2026–15/11/2026 range where the tab supports period filters. For each tab, compare the rendered report to its PDF, Excel, CSV, and JSON export. Mark a tab complete only after user-provided UI/export evidence is reconciled with the backend calculation and all four export payloads.

- [x] **23.7.1** Overview: key figures, definitions, daily revenue/expense series, top products, cash flow, and customer metrics reconciled across the latest PDF/CSV/Excel evidence; Excel no-baseline values display `—`.
- [x] **23.7.2** Sales: issued-invoice revenue, accepted returns, collections, positive outstanding/customer credits, customers, channel totals, and daily revenue reconciled; Sales PDF/CSV/Excel evidence checked.
- [ ] **23.7.3** Products: reconcile recognized invoice-line revenue after allocated discounts and accepted returns; quantity sold; stock-movement COGS/profit/margin; ranking modes; paging; and PDF/Excel/CSV/JSON values. Confirm PDF omits internal Product/Category IDs but retains SKU. Code fixes now return the typed current-stock quantity and actual default unit, add the selected period to exports, omit API page/limit metadata, and suppress internal IDs in PDF; backend tests (61/61), TypeScript, Nest build, and frontend type-check pass. UI and downloaded export evidence remain.
- [ ] **23.7.4** Customers: reconcile active-customer scope, sales/returns, frequency, recency/loyalty segmentation and ranking; verify each export and pagination/segment parameters.
- [ ] **23.7.5** Suppliers: reconcile non-draft purchase activity, accepted GRNs, quality and delivery timing; ensure suppliers without qualifying GRNs do not receive invented quality/lead-time values; verify all exports.
- [ ] **23.7.6** Finance: reconcile income statement, cash flow, receivables ageing, payables ageing, expense breakdown, business position and operational balance summary; verify daily/weekly/monthly behavior and all seven export types.
- [ ] **23.7.7** Inventory: reconcile active products, stocked SKUs, quantities, valuation method/as-of timestamp, low-stock items, fast movers and location scope; confirm current snapshot is not presented as historical; verify all exports.
- [ ] **23.7.8** Trends & forecast: reconcile historical series and forecast input periods; verify each metric/method, confidence interval, minimum-history empty state, and trend/forecast PDF/Excel/CSV/JSON exports.
- [ ] **23.7.9** Cross-tab exports: confirm selected date range and tab parameters are preserved in filenames/content; CSV encoding/escaping, Excel numeric cells/widths, PDF readability/pagination, and JSON structure are correct.

## Current handoff

Phase 23 remains in progress. Overview and Sales evidence are accepted. The user will provide the UI and export evidence for each remaining tab. Next tab: **23.7.3 — Products**. Product code review confirmed discount allocation, accepted-return deductions, and recorded-movement COGS logic; it also fixed product export period metadata, current-stock/unit response consistency, and PDF technical IDs. Backend tests (61/61), backend TypeScript, Nest build, and frontend type-check pass. Verify Products UI totals and PDF/Excel/CSV/JSON output before moving to Customers. General export-app visual check (23.4.21), authorization, responsive behavior, chart/loading checks, offline icon, and production build configuration remain open.
