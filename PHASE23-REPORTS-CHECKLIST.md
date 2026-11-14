# Phase 23 — Reports & Analytics

## Scope and integration audit

Phase 23 is a reporting layer over existing business records. It must remain read-only: report requests may write access/audit records, but must not modify invoices, returns, payments, expenses, purchase orders, stock balances, or accounting periods.

| Source area | Report connection | Rule the report must follow |
| --- | --- | --- |
| Sales invoices and returns | Revenue, invoice count, customer/product/channel reports | Recognized issued invoices; subtract only accepted/received returns according to the source report and selected dates. Revenue includes invoice tax; product-line revenue is before invoice tax. |
| Payments | Collections, cash flow, receivables/payables, business position | Active posted payment records only. Sales “collected” is paid against invoices issued in the range by its end date, while cash flow is payment activity inside the date range. |
| Inventory ledger and valuation | COGS, quantity, current value, low stock and movers | COGS comes from inventory movements/costing; purchases are procurement volume and are not COGS. Valuation is a current snapshot, not historical valuation for the selected dates. |
| Purchases, GRNs and supplier returns | Procurement, supplier delivery/quality reports, payables | Draft/cancelled orders are excluded; supplier delivery/quality measures depend on recorded GRNs and inspection. |
| Customers | Customer value, frequency and recency | Analytics are tenant-scoped; inactive/archived customers do not appear in active-account segmentation. |
| Expenses and categories | Income statement and expense breakdown | Only approved or paid expenses count as recognized expenses; draft/rejected expenses do not. |
| Business settings | Currency, date/time display and financial-year preset | Use business currency and the saved date preferences. “This financial year” starts at the configured financial-year month. |
| Permissions and audit | Reports page, API and exports | Viewing requires `reports.view`; downloads require `reports.export`. Successful reads/exports are audited; business ID comes from authenticated context. |

### Known accounting/data limits shown in the UI

- Inventory valuation is a live snapshot and must show its `asOf` time.
- Cash flow shows recorded payment movements, not a bank reconciliation.
- The current trial-balance endpoint is explicitly an operational balance summary. There is no complete double-entry general ledger or statutory trial balance yet.
- Forecasts are model estimates based on monthly history, not promised outcomes. Inventory forecasting is not supported by the endpoint.
- The backend response field `days120Plus` currently represents the combined overdue `91+ days` bucket; the UI labels it accurately without changing that response contract.

## Implementation and acceptance checklist

### Audit gaps against the supplied Phase 23 proposal

The pasted proposal listed additional claims that are not represented as explicit, verifiable features in the current report UI/API. Keep these visible rather than treating “reports implemented” as full coverage:

- **Sales conversion rate:** no lead, quote, visit or checkout-start denominator is recorded. Do not invent a conversion percentage from invoice counts; either add a real source event model or explicitly remove this requirement from product scope.
- **Repeat-customer metric:** customer frequency/recency reports exist, but the UI must expose and reconcile an explicit returning-customer count/rate if this promise is retained.
- **Collection period and bad-debt ratio:** ageing and outstanding balances exist, but an explicit collection-days calculation and a write-off/bad-debt source are not confirmed. Define the accounting formula and source before reporting either value.
- **Dead stock:** stock ageing and movements exist, but there is no verified “dead” threshold/definition surfaced as a report. Agree on the inactivity window and ensure it uses movement history before adding a label.
- **Chart families:** current report UI uses bar charts (including paired bars); the original line, composed and scatter chart claims are not all present. Add only when the underlying series and business question are defined.
- **Exports:** the source proposal listed PDF and Excel. The UI also offers CSV/JSON; verify all four downloads, selected filters, accurate file contents and export permission independently.

These gaps are not browser-green. Resolve them as product scope or implementation work before claiming Phase 23 matches every original proposal bullet.

Code checks and browser acceptance are tracked separately. A successful build does not make a browser task green.

| Task | Acceptance scope | Code status | Browser status |
| --- | --- | --- | --- |
| 23.1 | Reports navigation, `reports.view` access gate, retry/loading/error/empty states | Implemented | Pending |
| 23.2 | Date presets, custom inclusive range, custom grouping, business date/currency display | Report-settings context and configured weekly grouping connected; manual timezone/calendar-boundary reconciliation remains | Pending |
| 23.3 | Executive overview KPIs, revenue-vs-expense paired chart, top products, inventory snapshot disclosure | Implemented | Pending |
| 23.4 | Sales summary, returns-aware revenue, collections disclosure, location/salesperson/customer-type channels, top customers | Implemented | Pending |
| 23.5 | Product ranking, cost/margin and full server pagination | Implemented | Pending |
| 23.6 | Customer segment selector, recency/frequency and full server pagination | Implemented | Pending |
| 23.7 | Supplier GRN-derived delivery/quality measures and full server pagination | Implemented | Pending |
| 23.8 | Income statement, cash flow, receivable/payable ageing, expense categories, period comparison | Implemented | Pending |
| 23.9 | As-of financial position and clearly labelled operational balance summary | Implemented | Pending |
| 23.10 | Inventory snapshot/low stock/movers and link to detailed inventory reports | Implemented | Pending |
| 23.11 | Revenue/expense/profit/quantity/customer trends and three forecast methods | Implemented | Pending |
| 23.12 | CSV, Excel, PDF and JSON exports for selected report type and range; selected channel, product sort, customer segment, trend metric and forecast method passed end-to-end | Structured section/table exports implemented; PDF sample rendered, CSV sampled, XLSX package XML validated | Pending browser/API acceptance |
| 23.13 | Export permission, audit records, tenant isolation, no cross-business report data | Backend/UI gates reviewed | Pending API/session verification |
| 23.14 | Gold/charcoal visual system, responsive horizontal charts/tables, visible keyboard focus | Implemented | Pending |
| 23.15 | Reconcile top-customer/product growth, repeat-purchase frequency and recency to source transactions | Partial: frequency/recency and growth data exist; explicit repeat-customer KPI needs confirmation | Pending |
| 23.16 | Reconcile each metric, chart and export to source records; include zero, empty, negative-profit, returns, supplier credits and no-baseline cases | Code/UI reconciliation not demonstrated | Pending |
| 23.17 | Resolve/implement or explicitly defer the proposal gaps listed above | Gap register open | Pending |

## Verification

- [x] Frontend `pnpm exec tsc --noEmit` passes after final edits.
- [x] Backend `pnpm exec tsc --noEmit` passes after final edits.
- [x] Backend `pnpm exec nest build` passes after final edits.
- [ ] Frontend production `next build`: current workspace config blocks builds unless `NEXT_PUBLIC_API_URL` is set to a real HTTPS API URL ending `/api/v1`; TypeScript and targeted ESLint pass, but this production build has not passed for the current edits.
- [x] Rendered a representative two-page dashboard PDF and inspected its layout; verified the generated XLSX is a valid ZIP package with parseable XML parts and sampled the UTF-8 CSV output.
- [x] `git diff --check` passes (line-ending notices are not whitespace errors).
- [ ] Manual browser acceptance of 23.1–23.14, one item at a time.
- [ ] API verification for unauthorized access, tenant isolation, export formats and audit outcomes.
- [ ] Reconcile sample figures against source invoices, accepted returns, payments, GRNs, stock movements and expenses.

## Sequential UI run

Open `http://localhost:3000/dashboard/reports` as a user with `reports.view`. Start with **23.1** and stop for the user's visible result before advancing. Use a separate `reports.export` permission check for the export tasks. Do not mark any UI item green from source code or a toast alone.

## Detailed acceptance run

Record the task ID, selected tab, date range, account role, visible result and any error for every manual run. Keep the run read-only: do not create or edit source business transactions to force a report result.

### 23.1 Access and page states

- [ ] Open Reports & Analytics as `reports.view`; confirm the overview loads, loading state clears, and Refresh reloads the current tab/range.
- [ ] Open a direct link such as `/dashboard/reports?tab=finance`; confirm the requested tab, heading and export report type all match the link.
- [ ] With a user lacking `reports.view`, confirm the access-denied message appears and no report data is requested/rendered. With backend API access, confirm the endpoint rejects the same user.
- [ ] When authorized, force an unavailable API response and confirm a readable error plus Retry; when the response is empty, confirm an empty-state message rather than a broken table/chart.

### 23.2 Date, grouping, currency and business settings

- [ ] Try This month, Last month, This quarter, This financial year, and a custom date range; verify the displayed range and request parameters match the selected dates.
- [ ] Verify the custom end date is inclusive, invalid/reversed ranges are rejected before export, and changing the range resets pagination.
- [ ] Try every applicable grouping (daily, weekly, monthly, quarterly, yearly); check that unsupported grouping choices are not offered on Finance.
- [ ] Confirm the report-settings endpoint gives a reports-only user the current business currency, timezone, financial-year start, date format and week-start day without granting Settings access.
- [ ] Compare report currency, date format, financial-year start and timezone with saved business settings; repeat after switching business/account context so stale cached settings cannot leak.
- [ ] Verify business-local “today” around midnight in UTC and the configured timezone; verify financial-year preset dates for CALENDAR, JULY and APRIL starts.
- [ ] Verify Sunday and Monday week starts in trend buckets and cash-flow grouping; verify monthly, quarterly and yearly cash-flow grouping does not silently fall back to daily.
- [ ] For each report source, confirm whether its date is a calendar date or an instant. Calendar-date fields must include the selected business dates; timestamp fields must be bucketed/displayed in business timezone. Check midnight boundaries and daylight-saving zones.

### 23.3–23.4 Executive and sales

- [ ] Reconcile each executive KPI to its named source rule in the integration table; check prior-period comparison and the no-baseline state.
- [ ] Confirm Revenue/Expenses chart labels align with values and the selected grouping; inspect zero and negative values.
- [ ] Confirm top-product quantity/revenue, inventory snapshot `asOf`, and the current-snapshot disclosure.
- [ ] For Sales, verify issued invoices only, accepted returns deducted once, tax treatment, invoice counts, units, average order, unpaid count and balances.
- [ ] Compare “Collected by period end” with payments through the selected end date against invoices issued in range; compare cash flow separately to payment activity inside the date range.
- [ ] Switch sales channel between location, salesperson and customer type. Confirm unassigned/unknown groups are represented and totals reconcile without duplicating return revenue.

### 23.5–23.7 Product, customer and supplier analytics

- [ ] Products: change sort between revenue, quantity, profit and margin; move through first/middle/last pages; reconcile SKU/category, sold quantity, net line revenue, COGS, margin, current stock and no-movement values.
- [ ] Customers: change revenue/frequency/loyalty/recency segmentation and pages; confirm inactive/archived accounts are excluded, last transaction/recency is correct, and repeat-customer claims are not inferred from a score.
- [ ] Suppliers: compare purchase activity to non-draft/non-cancelled orders; verify accepted/rejected/damaged quantities from accepted GRNs, lead time/on-time values only where source dates exist, and null/coverage labels where evidence is missing.

### 23.8–23.9 Finance reports

- [ ] Income statement: reconcile issued sales net of accepted returns, COGS from inventory movements, approved/paid expenses, gross profit and net income. Draft/rejected expenses must not be recognized.
- [ ] Cash flow: reconcile opening balance + selected inflows − selected outflows = closing balance; verify voided payments are excluded and same-day ordering is stable.
- [ ] Receivables and payables: check each aging bucket at the selected as-of date; subtract recorded sales-return credits, customer payments and approved supplier-return credits; total detail rows must equal summary totals and financial position.
- [ ] Check orders with partial receipts, fully received orders, partial payments, overpayments/credits, returns, zero balance and future due dates.
- [ ] Financial position/trial-balance area must state valuation `asOf` and costing method, identify operational (non-double-entry) balances, and never describe the difference as a statutory trial-balance error.

### 23.10–23.11 Inventory and trends

- [ ] Inventory report summary is business-wide; low stock and fast movers reconcile to inventory service/movements; current valuation has an `asOf` disclosure.
- [ ] Follow inventory detail link and filter by each active location; do not treat active workspace location as an implicit report filter.
- [ ] Trends: change metric and grouping, then forecast metric/method/horizon; confirm series labels, units, dates and empty-history handling.
- [ ] Forecast must state it is an estimate, identify its training window and limitations, and must not present unsupported inventory forecasts.

### 23.12 Export formats and selected filters

- [ ] For each report type that offers export, download CSV, Excel/XLSX, PDF and JSON. Confirm valid file signature/content type, readable data, stable column labels, selected date range and correct extension.
- [ ] Export product performance under each selected sort; export customer analytics under each segment; export sales channel under each grouping; export trend and forecast under the selected metric/method/horizon.
- [ ] Verify large exports enforce the documented row cap with a useful error; verify text that begins with spreadsheet formula characters is escaped in CSV/XLSX.
- [ ] PDF layout: check title, generated time, key figures, readable section/table headings, wrapped long values, landscape page width, repeated table headers after page breaks, alternating rows and page numbers; confirm no flattened JSON/debug keys or clipped text.
- [ ] PDF typography and motion: inspect the 12 pt Times-compatible serif text at normal zoom and print scale; verify KPI counters and chart lines/bars take long enough to follow while `prefers-reduced-motion` still skips the animations.
- [ ] CSV: confirm UTF-8 BOM, human-readable headers, quoted commas/newlines, formula-injection protection and readable section separation in Excel/LibreOffice.
- [ ] Excel/XLSX: confirm workbook ZIP/XML opens without repair warnings, section/header styling, frozen top row, number cells remain numeric, long text is preserved and empty reports still open.
- [ ] JSON: confirm valid pretty-printed JSON preserves the API response shape and does not stringify data or change selected filters.
- [ ] Exercise zero rows, one row, wide tables, long names/notes, Unicode text, negative and decimal values, many pages, every export type, and each format on phone/tablet/desktop download flows.
- [ ] With `reports.view` but without `reports.export`, confirm exports are disabled in UI and denied by API. With both permissions, confirm a file downloads and a business-scoped audit event records type, range, format and result metadata.

### 23.13–23.17 Security, responsiveness, reconciliation and scope

- [ ] API/session: no token, expired token, user without permission, tenant A requesting tenant B IDs, and export-only/view-only permission combinations. Confirm no cross-business records and no secrets/credentials in errors or audit payloads.
- [ ] Confirm report GETs do not mutate source invoices, payments, returns, expenses, POs, GRNs, stock or accounting periods; expected access-audit records are the only report-side write.
- [ ] Responsive pass at narrow phone, tablet and desktop widths in Light, Dark and Photo glass; check filters, tab strip, charts, wide tables, export controls, focus visibility and no clipped actions.
- [ ] Reconcile at least one ordinary date range and explicit zero-data, empty-data, negative-profit, accepted-return, supplier-credit, no-baseline and no-GRN cases against source records.
- [ ] For each gap in the register, record the product decision (implement with a real source, remove from scope, or defer); do not mark 23.17 done while an advertised metric is unsupported or ambiguous.

## Code audit findings (14 Nov 2026)

- [x] Report API routes are connected to the Reports UI/store; the report view/export permissions are enforced on backend routes, and tenant identity is taken from authenticated business context.
- [x] Corrected direct-link export selection so `?tab=...` initializes the export type for that report instead of leaving the Overview export selected.
- [x] Connected product sort and customer segmentation selections to export requests, DTO validation and server report queries.
- [x] Corrected supplier payables ageing to subtract approved purchase-return credits as of the requested date, matching the financial-position calculation.
- [x] Added base-currency metadata to product, customer, supplier, trend, forecast and financial-position responses so deep-linked tabs format amounts in the business currency.
- [x] Rechecked frontend/backend `tsc --noEmit` and focused ESLint after these corrections; removed an unused payment-refresh argument found during lint review.
- [x] Added a `reports.view`-protected report-settings endpoint, so reports-only users receive server-owned currency, timezone, financial-year, date-format and week-start context without Settings access; financial-year presets use that context, and weekly analytics/cash-flow buckets respect the saved week start. Date-only input boundaries remain UTC calendar dates for existing date-based records; report acceptance must verify timestamp fields against business timezone before final sign-off.
- [ ] Manually verify date-only versus timestamp boundaries across report source fields and the timezone/date presets in 23.2; code integration alone is not an acceptance result.
- [ ] Complete PDF, CSV, XLSX and JSON export acceptance in 23.12; generated exports were restructured in code, but no browser download has yet been accepted by the user.
- [ ] Run full production builds, backend regression coverage, and manual API/export acceptance after this audit's code changes.

## Recommended test order across the connected phases

Test **Phase 25 (settings)** first so currency, dates, financial year, permissions and configured locations are stable; then **Phase 24 (inventory)** because COGS and valuation reports read the stock ledger; then **Phase 23 (reports)** so its combined totals can be reconciled to those verified sources. Phase 23 implementation is in place, but its browser checklist remains pending.
