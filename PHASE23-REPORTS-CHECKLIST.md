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
| 23.2 | Date presets, custom inclusive range, custom grouping, business date/currency display | Implemented | Pending |
| 23.3 | Executive overview KPIs, revenue-vs-expense paired chart, top products, inventory snapshot disclosure | Implemented | Pending |
| 23.4 | Sales summary, returns-aware revenue, collections disclosure, location/salesperson/customer-type channels, top customers | Implemented | Pending |
| 23.5 | Product ranking, cost/margin and full server pagination | Implemented | Pending |
| 23.6 | Customer segment selector, recency/frequency and full server pagination | Implemented | Pending |
| 23.7 | Supplier GRN-derived delivery/quality measures and full server pagination | Implemented | Pending |
| 23.8 | Income statement, cash flow, receivable/payable ageing, expense categories, period comparison | Implemented | Pending |
| 23.9 | As-of financial position and clearly labelled operational balance summary | Implemented | Pending |
| 23.10 | Inventory snapshot/low stock/movers and link to detailed inventory reports | Implemented | Pending |
| 23.11 | Revenue/expense/profit/quantity/customer trends and three forecast methods | Implemented | Pending |
| 23.12 | CSV, Excel, PDF and JSON exports for selected report type; selected sales channel/trend/method passed to API | Implemented | Pending |
| 23.13 | Export permission, audit records, tenant isolation, no cross-business report data | Backend/UI gates reviewed | Pending API/session verification |
| 23.14 | Gold/charcoal visual system, responsive horizontal charts/tables, visible keyboard focus | Implemented | Pending |
| 23.15 | Reconcile top-customer/product growth, repeat-purchase frequency and recency to source transactions | Partial: frequency/recency and growth data exist; explicit repeat-customer KPI needs confirmation | Pending |
| 23.16 | Reconcile each metric, chart and export to source records; include zero, empty, negative-profit and no-baseline cases | Code/UI reconciliation not demonstrated | Pending |
| 23.17 | Resolve/implement or explicitly defer the proposal gaps listed above | Gap register open | Pending |

## Verification

- [x] Frontend `pnpm exec tsc --noEmit` passes after final edits.
- [x] Backend `pnpm exec tsc --noEmit` passes after final edits.
- [x] Backend `pnpm exec nest build` passes after final edits.
- [x] Frontend `pnpm exec next build` passes after final edits using `NEXT_DIST_DIR=.next-phase23-build` (the normal `.next` directory returned `EPERM` while app output was in use).
- [x] `git diff --check` passes (line-ending notices are not whitespace errors).
- [ ] Manual browser acceptance of 23.1–23.14, one item at a time.
- [ ] API verification for unauthorized access, tenant isolation, export formats and audit outcomes.
- [ ] Reconcile sample figures against source invoices, accepted returns, payments, GRNs, stock movements and expenses.

## Sequential UI run

Open `http://localhost:3000/dashboard/reports` as a user with `reports.view`. Start with **23.1** and stop for the user's visible result before advancing. Use a separate `reports.export` permission check for the export tasks. Do not mark any UI item green from source code or a toast alone.

## Recommended test order across the connected phases

Test **Phase 25 (settings)** first so currency, dates, financial year, permissions and configured locations are stable; then **Phase 24 (inventory)** because COGS and valuation reports read the stock ledger; then **Phase 23 (reports)** so its combined totals can be reconciled to those verified sources. Phase 23 implementation is in place, but its browser checklist remains pending.
