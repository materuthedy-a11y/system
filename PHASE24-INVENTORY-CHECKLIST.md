# Phase 24 — Inventory Management

## Audit decisions

- Inventory lives under the existing authenticated dashboard at `/dashboard/inventory`; it is not a separate application route.
- Physical stock counts use the existing `PhysicalCount` workflow. The pasted “reconciliation” screens described the same snapshot/variance process, so this phase does not add a second reconciliation model or fictitious endpoints.
- Adjustment approval posts its stock change immediately, matching the backend. There is no second “complete adjustment” action.
- Reorder thresholds are stored on `Product.minimumStock` and `Product.reorderLevel`, so they currently apply across locations. The UI says this clearly instead of pretending the values are per-location.
- Inventory forms and filters use inventory-scoped product/location options; users with inventory permissions do not need an unrelated Products permission to load the screens.
- Reads and writes are scoped to the authenticated business. Stock-changing actions keep their server-side permission checks, transactional stock ledger writes, and audit records.

### Audit gaps against the supplied Phase 24 proposal

- The supplied Phase 24 text promised **delete draft adjustments** and **cancel transfers**. There are no corresponding `DELETE /inventory/adjustments/:id` or transfer-cancel endpoints in the current controller/route list. Those actions must either be implemented with draft-only/state guards and audit logging, or explicitly removed from the product contract; they are not covered by the existing approve/reject/send/receive tasks.
- Movement history is delivered as the **Movements** tab at `/dashboard/inventory/reports?view=movements`, not a standalone `/inventory/movements` page. The dashboard shortcut and direct deep link must both select that tab and preserve filters/pagination.
- The pasted proposal said an adjustment could be approved then completed; the actual backend posts stock during approval. Acceptance must assert a single stock-ledger effect at approval and must not expect a second completion action.
- Product-specific unit conversion factors are stored by the Products module, but no use of those factors was found in sales, purchasing or inventory stock mutation services. Cross-unit stock conversion is therefore an open integration gap; do not treat configured conversion factors as operational until the same quantity is converted consistently through documents, balances, valuation and movement history.

## Implementation and acceptance checklist

“Code ready” means the implementation is present and compile/build checks passed. “UI GREEN” is reserved for the user’s visible browser result and is still pending unless marked below.

| Task | Scope | Code status | UI status |
| --- | --- | --- | --- |
| 24.1 | Inventory navigation, permission gate, shared loading/error/empty states | Code ready | Pending |
| 24.2 | Stock overview KPIs, location/product balances, recent movements | Code ready | Pending |
| 24.3 | Adjustment queue, status/location/search filters and paging | Code ready | Pending |
| 24.4 | Create adjustment with signed quantity, reason, batch and notes | Code ready | Pending |
| 24.5 | Adjustment detail, approve-and-post or reject with required reason | Code ready | Pending |
| 24.6 | Transfer queue and filters | Code ready | Pending |
| 24.7 | Create transfer between distinct active locations | Code ready | Pending |
| 24.8 | Send transfer, partial/full receipt, bounds validation and detail | Code ready | Pending |
| 24.9 | Physical count queue and filters | Code ready | Pending |
| 24.10 | Create count from a system snapshot and show variance | Code ready | Pending |
| 24.11 | Complete then post count; reject stale snapshots | Code ready | Pending |
| 24.12 | Valuation, low-stock, expiry, ageing and movement reports | Code ready | Pending |
| 24.13 | Reorder thresholds, validation and audit trail | Code ready | Pending |
| 24.14 | Inventory permissions, business isolation, responsive layouts and retry/loading behavior | Code reviewed | Pending |
| 24.15 | Draft adjustment deletion and transfer cancellation: implement guarded audited endpoints or explicitly remove both promised actions from scope | Missing from current API; unresolved | Pending |
| 24.16 | Movement history deep link, filters, pagination, signed quantities and source references | Code ready; browser route/state unverified | Pending |
| 24.17 | Transaction edge cases: insufficient stock, same/inactive locations, invalid quantities, over-receipt, stale count snapshots and duplicate submits | Not fully captured by prior smoke checklist | Pending |
| 24.18 | Verify each stock mutation changes balances and movement history exactly once; rejected/cancelled/draft operations do not change stock | Not yet reconciled against live DB | Pending |
| 24.19 | Verify sales, receiving and inventory adjustments use product-unit conversion factors consistently, or explicitly constrain all stock-changing quantities to the base unit | Audit gap: no conversion consumer found in stock mutation services | Pending |

## Backend routes wired to the UI

- `GET /inventory/dashboard`, `/balances`, `/options`, `/reorder-points`
- `GET /inventory/adjustments`, `/adjustments/:id`; `POST /adjustments`, `/:id/approve`, `/:id/reject`
- `GET /inventory/transfers`, `/transfers/:id`; `POST /transfers`, `/:id/send`, `/:id/receive`
- `GET /inventory/counts`, `/counts/:id`; `POST /counts`, `/:id/complete`, `/:id/post`
- `GET /inventory/reports/valuation`, `/low-stock`, `/expiry`, `/ageing`, `/movements`
- `PATCH /inventory/reorder-points/:productId`

## Verification so far

- Backend `pnpm exec tsc --noEmit`: passed.
- Frontend `pnpm exec tsc --noEmit`: passed.
- Backend `pnpm exec nest build`: passed.
- Frontend optimized `next build`: passed and generated all inventory routes.
- `git diff --check`: passed; only line-ending notices were reported.
- Full backend `pnpm build` did not finish its Prisma generate step because Windows denied replacing the Prisma query-engine DLL (`EPERM`), consistent with another process holding that file. Nest compilation itself passed.
- Browser acceptance and live database-backed inventory flows remain unverified; do not mark them green until each screen/action is observed in the running app.

## Sequential UI run

Start at **24.1** and stop after each task until the user reports the visible result. Begin with:

`http://localhost:3000/dashboard/inventory`

For transactions, use existing active products and locations. Use a low-risk test quantity and confirm the displayed before/after stock; never infer success from a toast alone. Record the resulting reference/status and verify it appears in the matching list and movement report before marking that workflow green.
