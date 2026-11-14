# Phase 23 — Reports & Analytics QA Checklist

This checklist records observed behavior and code-level fixes. A section is GREEN only after its stated checks pass; an implementation or type-check alone does not count as browser verification.

## 23.1 Access control and report routing

- [x] `reports.view` protects report endpoints.
- [x] A user without `reports.view` sees the access-required state and no report data/export controls; user confirmed no report request was sent.
- [x] Direct `?tab=finance` opens Finance, and tab selection updates the URL. Fixed tab initialization race in `app/dashboard/reports/page.tsx`.
- [ ] Recheck direct links and browser Back/Forward on desktop and mobile after the latest build is available.

## 23.2 Date ranges and grouping

- [x] Last month: 01/10/2026–31/10/2026; zero period revenue, current inventory clearly disclosed as a live snapshot.
- [x] This quarter: 01/10/2026–14/11/2026; weekly buckets.
- [x] This financial year: 01/01/2026–14/11/2026; monthly buckets. Current setting uses the calendar year start.
- [x] Custom range 01/11/2026–14/11/2026.
- [x] Reversed From/To is rejected with one toast and no invalid report request/error panel.
- [x] Overview quarterly and yearly grouping return the expected 2026-Q4 and 2026 buckets.
- [x] Finance grouping is limited to Daily, Weekly, Monthly because the financial report API groups cash flow at those intervals.
- [x] Daily Finance cash movement: inflows 5,313; outflows 1,700; closing net 3,613 TZS.
- [x] Weekly Finance grouping reconciles to 3,611 TZS for the week beginning 02/11 and +2 TZS for the week beginning 09/11.
- [x] Monthly Finance grouping reconciles to 5,313 inflows − 1,700 outflows = 3,613 TZS.
- [x] Finance `asOf` date displays the selected business calendar date, not the next UTC day.
- [ ] Test leap day, month/year boundaries, business timezone, and configured non-Monday week start.

## 23.3 Sales, returns, and receivables reconciliation

Test range: 01/11/2026–03/11/2026, grouped by Issue date.

- [x] Invoice list supports both Invoice date and Issue date; selecting Issue date returns the seven issued invoices shown in the QA run. Backend date filtering and UI date label use the same basis.
- [x] Gross invoice total: 25,724 TZS across 7 invoices.
- [x] Accepted/received returns: 8,024 TZS; rejected returns are excluded.
- [x] Net revenue: 25,724 − 8,024 = 17,700 TZS, matching the Overview and Sales reports.
- [x] Sales-by-location totals reconcile: PH21 Test Branch 14,160 + Main Warehouse 3,540 = 17,700 TZS.
- [x] Sales report uses positive balances for Outstanding (14,160 TZS) and excludes the 1,770 TZS customer credit from receivables.
- [x] Added a separate Customer credits metric so the overpayment/return credit is visible instead of hidden in a negative invoice balance.
- [x] Added regression coverage for accepted returns, overpayment credit, zero positive outstanding, and unpaid invoice count.
- [x] Refreshed Sales report: Customer credits = 1,770 TZS, Outstanding = 14,160 TZS, and net positive receivable = 12,390 TZS; user confirmed the metric appeared.
- [x] Browser values reconcile: revenue 17,700 TZS; location revenue 14,160 + 3,540 = 17,700 TZS; invoices 7; collections 5,310 TZS.
- [ ] Test a fully refunded invoice, a return outside the selected period, and a payment received after the selected end date.

## 23.4 Exports and document presentation

- [x] PDF code audit confirms Times-Roman with 12 pt table body, landscape pages, and wrapped long cells.
- [x] Fixed PDF-only label sanitizing (`·` no longer becomes `?`), removed internal customer IDs from the Top Customers PDF table, added column padding/weighted widths, and padded multiline table rows so text stays inside its colored row backgrounds.
- [x] Added page preflight so short Top Customers tables do not leave a single orphaned row on the next page.
- [x] Executive Overview PDF now includes the visible summary, definitions, revenue/expense series, and Top Products table without the duplicate internal KPI catalogue; structured exports retain nested executive chart series.
- [x] Added Sales Summary channel breakdown and grouped revenue trend to PDF, CSV, XLSX and JSON exports; UI grouping is preserved and rendered as readable labels.
- [x] Cleaned Sales Summary trend exports to `Period` and `Revenue` only; removed raw end-of-day ISO timestamps, percent-change and moving-average fields that are not shown in the Sales report.
- [x] Added regression coverage for two/three-customer pagination, executive chart-series retention, PDF labels, 12 pt Times-Roman text, visible overview sections, and Sales Summary data in all four formats.
- [x] CSV regression verifies UTF-8 BOM, quoted/escaped values, CRLF records, and spreadsheet formula-injection prefix protection.
- [x] XLSX regression opens the generated ZIP entries and confirms the channel/trend sheets contain the expected data without internal trend calculation fields; JSON regression checks the same values.
- [x] Rendered the latest backend PDF output from representative executive and sales data: both use readable 12 pt Times-Roman tables, line backgrounds contain wrapped text, IDs are omitted from human-facing tables, and pagination is 3 pages for the current representative data.
- [ ] Re-export Sales summary for 01/11–14/11 and Executive Overview in the browser to confirm final downloaded layouts against live data.
- [ ] Browser verify the downloaded filenames, selected filters/date range, CSV opening in spreadsheet software, and PDF appearance against the current live records.
- [ ] Verify export permission separately from view permission, including direct API authorization.
- [ ] Verify narrow-screen export controls and downloaded document readability.

## 23.5 Charts, loading, and responsive behavior

- [ ] Check chart values against the underlying daily/weekly/monthly series, including zero-value and one-period ranges.
- [ ] Check loading animation timing, reduced-motion preference, and no stale chart shown after changing tabs/ranges.
- [ ] Check at mobile, tablet, and desktop widths in light and dark modes; verify tab scrolling, labels, tooltip access, and no clipped content.

## 23.6 Build and automated audit status

- [x] Frontend TypeScript check: `pnpm run type-check` passed.
- [x] Backend TypeScript check: `pnpm exec tsc --noEmit` passed.
- [x] Backend Jest suite: 7 suites, 58 tests passed after the current PDF/export and sales changes.
- [x] Backend Nest compile: `pnpm exec nest build` passed.
- [x] Frontend ESLint on the changed reports, sales-invoices, offline, PWA, and reports API files passed.
- [ ] Visually verify the red disconnected-Wi-Fi icon in browser offline mode (code updated in `/offline`, offline fallback, and the PWA banner).
- [x] Full backend `pnpm run build`: Prisma Client generation and Nest production compile both passed on the latest retry.
- [ ] Frontend production build: blocked by the repository's production config because `.env.production` still contains the placeholder API URL `https://api.your-domain.com/api/v1`. Set the actual HTTPS deployment URL before treating production build as verified.

## Current handoff

Phase 23 remains in progress pending the listed live-browser checks. Sales reconciliation (23.3), source-level export fixes, automated tests, PDF render review, CSV safety, and XLSX/JSON payload checks are confirmed. The next browser step is to download the current Executive Overview and Sales Summary in PDF and CSV, then check the same filters and filenames. The Wi-Fi indicator needs an offline-mode visual check.
