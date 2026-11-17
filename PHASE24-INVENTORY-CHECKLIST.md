# Phase 24 — Inventory Management

## Audit decisions

- Inventory lives under the existing authenticated dashboard at `/dashboard/inventory`; it is not a separate application route.
- Physical stock counts use the existing `PhysicalCount` workflow. The pasted “reconciliation” screens described the same snapshot/variance process, so this phase does not add a second reconciliation model or fictitious endpoints.
- Adjustment approval posts its stock change immediately, matching the backend. There is no second “complete adjustment” action.
- Reorder thresholds are stored on `Product.minimumStock` and `Product.reorderLevel`, so they currently apply across locations. The UI says this clearly instead of pretending the values are per-location.
- Inventory forms and filters use inventory-scoped product/location options; users with inventory permissions do not need an unrelated Products permission to load the screens.
- Reads and writes are scoped to the authenticated business. Stock-changing actions keep their server-side permission checks, transactional stock ledger writes, and audit records.
- Operational inventory summaries are also location-scoped: Owner/Admin see all active locations; other staff see only their assigned active locations. Inventory reports remain business-wide only where the Reports product explicitly says so.
- Sales and purchases convert selected product units into the product base unit before updating stock. Inventory adjustments, physical counts and transfers operate in base units; transfer requests now reject a supplied non-base-unit label and store the product's base-unit name.

### Audit gaps against the supplied Phase 24 proposal

- The supplied Phase 24 text promised **delete draft adjustments** and **cancel transfers**. There are no corresponding `DELETE /inventory/adjustments/:id` or transfer-cancel endpoints in the current controller/route list. Those actions must either be implemented with draft-only/state guards and audit logging, or explicitly removed from the product contract; they are not covered by the existing approve/reject/send/receive tasks.
- Movement history is delivered as the **Movements** tab at `/dashboard/inventory/reports?view=movements`, not a standalone `/inventory/movements` page. The dashboard shortcut and direct deep link must both select that tab and preserve filters/pagination.
- The pasted proposal said an adjustment could be approved then completed; the actual backend posts stock during approval. Acceptance must assert a single stock-ledger effect at approval and must not expect a second completion action.
- Product-specific unit conversion factors are used by sales and purchase documents and are normalized to base-unit stock quantities. Inventory transfer/adjust/count APIs do not convert alternate units; they must accept base-unit quantities only. Transfer input now enforces that boundary. Verify the unit label and stock movement match the product base unit in API/browser acceptance; existing legacy transfers may still display the old `UNIT` label.

## Implementation and acceptance checklist

“Code ready” means the implementation is present and compile/build checks passed. “UI GREEN” is reserved for the user’s visible browser result and is still pending unless marked below.

| Task | Scope | Code status | UI status |
| --- | --- | --- | --- |
| 24.1 | Inventory navigation, permission gate, shared loading/error/empty states | Code ready | Pending |
| 24.2 | Stock overview KPI definitions, saved balance rows vs implicit-zero reorder pairs, location filter scope, recent movements | Code clarification and API names updated; regression test added | Partial pass: user confirmed 9 products, 592 btl, TSh 787,200, 43 pairs, and PH24 SKU balances MAIN 11 btl + PH21 2 btl (13 total); 26 rows and remaining filters/paging checks still need confirmation |
| 24.3 | Adjustment queue, status/location/search filters, paging and return navigation to Inventory overview | Standardized Back to inventory as a touch-friendly emerald text link with hover/focus states | User confirmed adjustment list, filters and pagination green; global return-link visual is checked separately |
| 24.4 | Create adjustment with signed quantity, reason, batch and notes | Code ready | UI GREEN: `ADJ-202611-00002` (`cmwl4mcpo0007db1tud0e4xfe`) PENDING; PH24 QA SKU / Main Warehouse system 11, +1, after 12, SYSTEM_CORRECTION; CREATE audit has line note and record note; movement list has no row for this new reference |
| 24.5 | Adjustment detail, approve-and-post or reject with required reason; confirmation dialog covers the full viewport | Portal-rendered full-viewport overlay; prior ADJ-202611-00001 source movement recorded. User confirms ADJ-202611-00002 posted +1: PH24 MAIN 11 → 12, branch remains 2, total 592 → 593 btl, value TSh 787,200 → 788,200, reorder pairs 43 | Partial pass: balance/valuation reconcile; verify new movement reference `cmwl4mcpo0007db1tud0e4xfe`, APPROVE audit event, and full-screen modal visual |
| 24.6 | Transfer queue and filters | Code ready | Pending |
| 24.7 | Create transfer between distinct active locations | Code ready | Pending |
| 24.8 | Send transfer, partial/full receipt, bounds validation and detail | Code ready | Pending |
| 24.9 | Physical count queue and filters | Code ready | Pending |
| 24.10 | Create count from a system snapshot and show variance | Code ready | Pending |
| 24.11 | Complete then post count; reject stale snapshots | Code ready | Pending |
| 24.12 | Valuation, low-stock, expiry, ageing and movement reports, with return navigation to Inventory overview from every tab | Standardized Back to inventory as a touch-friendly emerald text link with hover/focus states on all report tabs | New visual style browser check pending; report filters/data remain in report checklist |
| 24.13 | Reorder thresholds, validation, business-wide threshold interaction, audit/no-op behavior, search/paging and Inventory return navigation | Added Back to inventory text link; reorder endpoint is business-scoped, permission-guarded, transactional and audited; identical saves now return idempotently without duplicate update/audit; focused service tests 6/6 pass | Browser checks pending |
| 24.14 | Inventory permissions, business isolation, responsive layouts and retry/loading behavior | Code reviewed; fixed dashboard leakage across unassigned locations | Pending |
| 24.15 | Draft adjustment deletion and transfer cancellation: implement guarded audited endpoints or explicitly remove both promised actions from scope | Missing from current API; unresolved | Pending |
| 24.16 | Movement history deep link, filters, pagination, signed quantities and source references | Fixed initial URL-tab race and stale-response overwrite | UI green reported; full filters/paging pending |
| 24.17 | Transaction edge cases: insufficient stock, same/inactive locations, invalid quantities, over-receipt, stale count snapshots and duplicate submits | Not fully captured by prior smoke checklist | Pending |
| 24.18 | Verify each stock mutation changes balances and movement history exactly once; rejected/cancelled/draft operations do not change stock | Not yet reconciled against live DB | Pending |
| 24.19 | Verify Sales/Purchases convert product units to base quantity; inventory transfer/adjust/count stay in base units and expose an accurate base-unit label | Sales/Purchases conversion confirmed in code; transfer rejects alternate-unit labels and stores the product base unit; API/browser verification pending | Pending |
| 24.20 | Low-stock boundary: `belowMinimum` is strict (`quantity < minimumStock`); reorder warning is inclusive (`quantity <= reorderLevel`) | Fixed and regression test added for quantity exactly at minimum | Pending |
| 24.21 | Database tenant integrity: enforce same-business product/location relationships for balances, movements, transfers, adjustments, counts and their lines | Prisma currently relies on service validation for several cross-tenant relationships; no migration applied in this audit | Pending |
| 24.22 | Cross-module inventory reconciliation using existing Sales/Purchase/Return history and a new isolated PH24 transfer/count fixture | Fixture created in local development DB; baseline balances and movement net reconcile to 12 btl; historical source reconciliation pending | Partial pass; UI pending |
| 24.23 | Prove baseline + adjustment + transfer send/partial/full receive + physical-count post preserve exact balances, ledger net, valuation and audit history | Scenario and expected arithmetic documented below; UI/API execution pending | Pending |

## Backend routes wired to the UI

- `GET /inventory/dashboard`, `/balances`, `/options`, `/reorder-points`
- `GET /inventory/adjustments`, `/adjustments/:id`; `POST /adjustments`, `/:id/approve`, `/:id/reject`
- `GET /inventory/transfers`, `/transfers/:id`; `POST /transfers`, `/:id/send`, `/:id/receive`
- `GET /inventory/counts`, `/counts/:id`; `POST /counts`, `/:id/complete`, `/:id/post`
- `GET /inventory/reports/valuation`, `/low-stock`, `/expiry`, `/ageing`, `/movements`
- `PATCH /inventory/reorder-points/:productId`

## Verification so far

- Backend `pnpm exec tsc --noEmit --incremental false`: passed after the inventory scoping and concurrency fixes.
- Frontend `pnpm exec tsc --noEmit --incremental false`: passed after the inventory UI update.
- Full backend `pnpm exec jest --runInBand`: 11 suites / 108 tests passed after the dashboard row-vs-pair and unit-breakdown regression was added.
- Focused ESLint on changed backend/frontend production modules passed with the repository's Prettier rule disabled; the default rule reports CRLF/formatting throughout the Windows checkout, so no broad rewrite was applied.
- Backend `pnpm exec nest build` passed in the previous phase; rerun for release after the local output lock is cleared.
- Frontend optimized `next build`: passed and generated all inventory routes.
- `git diff --check`: passed; only line-ending notices were reported.
- Full backend `pnpm build` did not finish its Prisma generate step because Windows denied replacing the Prisma query-engine DLL (`EPERM`), consistent with another process holding that file. Nest compilation itself passed.
- Browser acceptance and live database-backed inventory flows remain unverified; do not mark them green until each screen/action is observed in the running app.

## Deep code audit additions (17 Nov 2026)

- [x] Inventory dashboard previously returned stock balances, stock value, expired batches, recent movements and pending-operation counts across every business location even when the signed-in staff member was assigned to only a subset. It now applies the authenticated user's accessible locations to all location-derived dashboard totals and queues; transfer/adjustment rows are included only when all involved locations are accessible. Owner/Admin retain all-location visibility.
- [x] Reorder-point writes now use the serializable transaction helper, preserving the invariant `minimumStock <= reorderLevel` when simultaneous edits race; serialization conflicts return a refresh/retry conflict instead of silently accepting stale values.
- [x] Corrected low-stock classification at the boundary: stock exactly at minimum is no longer falsely called “below minimum”; it can still be at/below the reorder threshold.
- [x] Clarified dashboard counts: the balances table lists only persisted `StockBalance` rows (24 across all accessible locations; 3 for PH20 in the observed QA state). Low-stock count treats a missing product/location row as zero, so 38 reorder pairs can legitimately exceed the 24 persisted rows. API/UI now call this `lowStockProductLocationPairs` / “Pairs at/below reorder”; no fake zero balance rows are inserted into the database.
- [x] Location dropdown scope clarified: it filters only the balances table and recent movements. Dashboard KPIs and active-location count remain global across locations accessible to the user; selecting PH20 must not mutate data or recalculate those global totals.
- [x] Removed the misleading aggregate quantity KPI. Dashboard stock quantities are grouped by each product's configured base-unit symbol (with `UNIT` fallback for legacy products lacking a base unit); unlike quantities are no longer added together, and zero-total unit groups are hidden. Validate product base-unit labels in detailed workflows separately (24.19).
- [x] Made the `All activity` movement-history link visibly interactive using a bordered green button treatment, hover state, arrow icon, and keyboard-visible focus ring.
- [x] Fixed the initial Movement history route race: the page now reads `?view=movements` before issuing its first report request. Superseded responses are ignored and previous report rows/totals are cleared while a new report loads.
- [x] Strengthened below-minimum stock quantities in the dashboard table to `text-red-600` in Light mode and `text-red-400` in Dark mode, with bold weight.
- [x] Transfer records now use the product's configured base-unit name. A caller supplying a different unit label is rejected because that endpoint stores the numeric quantity as base units and does not perform conversions.
- [x] Added regression tests for staff location scoping on dashboard/queues and minimum-stock boundary semantics.
- [x] Added dashboard regression asserting persisted `StockBalance` row count is distinct from implicit-zero product/location reorder pairs, and that aggregate quantities are grouped by base-unit symbol.
- [x] Standardized contextual return links across dashboard detail/form pages and styled All activity with the same visible emerald hover/focus treatment; final browser check of this updated text-link treatment remains pending.
- [x] Applied stronger red emphasis to on-hand quantities at/below the product minimum; Light/Dark visual confirmation remains pending.
- [x] Added `pnpm db:seed:phase24-inventory`: creates one clearly named PH24 QA product with an opening adjustment and one matching movement per location, only when `NODE_ENV=development` and the DB host/name are exactly localhost/genuine. It is idempotent, refuses unrelated SKU collisions, never resets an existing fixture, and prints a balance-vs-ledger reconciliation before use.
- [x] Focused Inventory, Reports-permission and business-authorization Jest suites pass (3 suites, 14 tests); backend and frontend TypeScript checks pass.
- [x] Full backend Jest suite passes (11 suites, 107 tests).
- [ ] DB schema review found that StockBalance has no `businessId` and several inventory foreign keys reference product/location IDs without a composite tenant key. Services validate these relationships, but the DB does not independently reject a cross-business pair. Decide and implement a safe data backfill plus composite constraints in 24.21 before calling tenant integrity fully hardened.
- [ ] Frontend production build and final broad responsive/browser audit remain before Phase 24 sign-off. Local optimized build did not finish in this session; TypeScript passed. Do not mark build/UI acceptance green on TypeScript alone.
- [ ] Browser-check assigned-location versus Owner/Admin totals, boundary threshold, and transfer base-unit error/result before marking UI GREEN.

## Sequential UI run

Run the following in order. Do not skip a section because its page loads; each section is green only after its filters, validations, state change, audit record and resulting balance/movement have been checked. For every stock-changing test, write down the starting quantity for the exact product and location first. Use a QA product and a small quantity. A success toast alone is not evidence: verify the detail record, resulting balance, exactly one movement per posted quantity, and the audit event. Preserve the returned record number/status in the checklist.

### 24.1 — Inventory dashboard, access and page states

Open `http://localhost:3000/dashboard/inventory`.

- [ ] Confirm Stock overview, Active products, Combined quantity, Stock value, Pairs at/below reorder, recent movements and the four entry points render without overlap or console/API errors.
- [ ] Reconcile the observed QA snapshot: 8 active products, 6 accessible active locations, 24 persisted balance rows across all locations, 3 saved rows for PH20, 38 product/location pairs at or below reorder, and no recent PH20 movements. The 24 and 38 counts have different definitions and are not expected to match.
- [ ] After seeding PH24, expect 9 active catalog products, approximately 591 btl combined in the btl group, approximately TSh 786,200 stock value under the current cost basis, and 26 persisted balance rows. Reorder-pair count is expected to increase by five (four implicit-zero locations plus PH21 stock 2 at/below reorder 4), from 38 to 43. Reconcile actual UI values before proceeding; valuation may expose a costing-layer mismatch that requires investigation.
- [ ] Change All locations to PH20. Only table rows and recent movements should be filtered (3 rows and no movements in the observed QA state); global KPIs must remain unchanged. Change back to All locations and verify the original 24-row list returns. Confirm the filter never writes or changes stock.
- [ ] Confirm stock quantity is shown grouped by base-unit symbol, without summing unlike units. Reconcile the TSh 774,200 value with valuation report and costing method.
- [ ] Compare displayed stock by location to the balances table; compare value with the selected costing method and valuation report. Confirm total locations counts only the locations allowed for this user.
- [ ] Confirm the page states “locations you can access”; Owner/Admin should see all active locations, while a staff test account should see only its assigned locations, including when assigned to more than one.
- [ ] Refresh twice; no duplicate movement, stale count, flicker into the wrong business, or changed stock values should result. Check loading, API-error/retry and genuinely empty states.
- [ ] Open Stock adjustment, Stock transfer, Physical count and Inventory reports links; each must reach its correct screen and show the required permission gate when accessed without its permission.
- [ ] At a narrow phone width, tablet and desktop, check no clipped action/filter, horizontal page overflow, inaccessible table actions, broken tab navigation or unreadable Light/Dark/Photo-glass surfaces.

### 24.2–24.3 — Balances, locations, search and pagination

- [ ] In Recorded stock balances, compare All locations with each accessible location; materialized rows must have no duplicate product-location pairs. A missing row represents zero for reorder-pair calculations, not a persisted balance. Compare the global pair KPI to the low-stock report's documented scope.
- [ ] Search by exact product name, partial name and SKU; clear the search. Change location while on a later page and confirm the page resets and result totals match.
- [ ] Check no-result search, no balances, page 1/middle/last page, previous/next disabled states, refresh, and stable sort order.
- [ ] Directly request an unassigned location and a location ID from another business. The request must be denied or return no rows; it must not reveal the location, product quantities or record names.
- [ ] Reconcile each displayed on-hand quantity to `StockBalance`; do not count implicit-zero pairs as saved balance rows. Ensure captions retain this distinction and the KPI does not change with the detail filter.

### 24.4–24.5 — Stock adjustment end-to-end

- [ ] From the dashboard/queue, open New adjustment. Check active product and permitted active location options, unit/base-unit label, reason choices, notes and optional batch number.
- [ ] Validate required product/location/reason, quantity zero, invalid/non-finite quantity, duplicate product-location-batch line, inactive product/location, unassigned location and cross-business IDs. Invalid requests must not create a record or change stock.
- [x] Use a QA product and a small positive difference. Save; record adjustment number and starting stock. User evidence: `ADJ-202611-00002` / `cmwl4mcpo0007db1tud0e4xfe`, PH24-QA-TRANSFER-001 / Main Warehouse, system 11, delta +1, proposed 12, reason SYSTEM_CORRECTION, line note “PH24 24.4 positive delta draft”, record note “Phase 24.4 QA”; PENDING status and absence of a movement for the new reference were verified before approval.
- [ ] Search and filter the queue by adjustment number/notes, status and location; paginate and open the matching detail. Confirm current quantity + difference = proposed after-approval quantity.
- [ ] Approve once. Confirm status becomes approved, balance changes by exactly the signed difference, one `ADJUSTMENT` movement references this adjustment, and the audit log records actor/action/time. Repeat approve and confirm it is rejected with no second movement.
- [ ] Create a second small negative adjustment on test stock; verify insufficient/negative-stock policy, approve and reconcile signed movement and balance.
- [ ] Create another pending adjustment and reject it with a reason. Empty reason must fail; rejected status and reason must be visible; balance and movement history must remain unchanged.
- [ ] Confirm the product/location/batch/reason/notes in the detail and movement source reference match the submitted data. Draft adjustment deletion is currently absent (24.15); record this as a known gap rather than pretending the delete action passed.

### 24.6–24.8 — Stock transfer end-to-end

- [ ] Open New transfer. Confirm source and destination picklists contain only active locations accessible to the user; same location is not allowed. Confirm product is active and amount is in the product’s base unit.
- [ ] Validate missing locations/items, same source/destination, duplicate product line, zero/negative/non-finite quantity, inactive/cross-business location or product, inaccessible location and an alternate-unit label. Each invalid request must fail without a record or stock mutation.
- [ ] Choose a QA product with enough stock at source. Record source and destination balances; create a small transfer; save transfer number. In DRAFT, neither balance nor movement history changes.
- [ ] Filter/paginate transfer queue by number/notes, status and either location. Open detail and confirm requested lines, source, destination and base unit.
- [ ] Send once. Confirm source decreases by requested quantity, destination stays unchanged until receipt, status becomes SENT, and exactly one negative `TRANSFER` movement is recorded at source. Re-send must not deduct again.
- [ ] Receive part of one line. Confirm destination increases only by the received amount, `receivedQuantity` and remaining amount reconcile, status becomes PARTIAL, and one positive movement is recorded for that receipt.
- [ ] Receive the remainder in a second request. Confirm status becomes COMPLETED and total destination received equals requested quantity; source decrease equals destination increase across the completed transfer.
- [ ] Attempt unknown item ID, negative/non-finite/over-remaining quantity, all-zero receipt, duplicate receive and receive after completion. Each must be rejected with no extra stock movement.
- [ ] Attempt send with insufficient source stock; confirm status remains DRAFT, neither location changes, and no movement is created.
- [ ] Verify audit events for create/send/each receipt. Transfer cancellation is not implemented (24.15); do not mark cancellation green.

### 24.9–24.11 — Physical count / reconciliation end-to-end

- [ ] Open New physical count. Confirm only active, accessible locations and products are selectable; duplicate products are blocked; counted quantity cannot be negative or invalid.
- [ ] Create a count and record the system snapshot, physical quantity and variance (`counted − system`). Before completion/posting, stock balances and movement history must not change.
- [ ] Filter/paginate counts by count number/notes, status and location. Open detail and reconcile every line, variance count, net variance and value.
- [ ] Complete the count. Confirm it freezes the count for review but still does not alter stock; repeat completion must be rejected.
- [ ] Post a count with a positive variance and one with a negative variance using QA stock. Confirm each balance becomes the counted quantity and a single `ADJUSTMENT` movement equals the variance; zero-variance lines create no unnecessary movement.
- [ ] Stale-snapshot test: create count, then change that product/location stock through another posted operation before posting the count. Posting must fail with a stale-snapshot message and must not overwrite the newer stock.
- [ ] Confirm negative stock policy, audit events for create/complete/post, no duplicate posting, and visibility of the source count reference in movements.

### 24.12 — Every Inventory report and its filters

- [ ] **Valuation:** compare FIFO, LIFO and WEIGHTED_AVERAGE to the same movement layers; filter by product/location; reconcile quantity × layer cost to row value and all-row total. Check pagination does not change the grand total, zero stock, legacy/untracked opening stock, as-of time and costing label.
- [ ] **Low stock:** exercise All/Below minimum/At or below reorder (and every available type option), product/location filters, search and pagination. At exactly minimum, `Below minimum` is false; at exactly reorder, `At or below reorder` is true. Check global threshold interaction is disclosed and `daysToStockout` uses the defined usage period; no usage should show `—`.
- [ ] **Expiry:** check EXPIRED, 7-, 30-, 90-day, ALL and custom as-of options that the UI exposes; compare batch, remaining quantity, expiry date and days to source layers. Untracked stock must be disclosed, not invented as a batch.
- [ ] **Ageing:** change as-of date; reconcile receipt layers, age days, ageing bucket, cost/value and untracked quantity. Check bucket boundaries at 30/31, 60/61, 90/91 and 180/181 days.
- [ ] **Movements:** filter product, location, type, date-from/date-to, reference ID and sort by createdAt/type/quantity in ascending and descending order. Check inclusive date end, signed quantity, source reference, actor/date, count/pagination and direct link `/dashboard/inventory/reports?view=movements`.
- [x] User reported Movement history now loads green. Direct/deep-link first-load bug is accepted at UI level; regression on report-tab switching and manual refresh race remains to retest during report filters.
- [ ] For all reports, compare table to exact API response; test empty result, one result, invalid dates/filter IDs, retry, paging and responsive tables. Confirm summary totals are all-row totals, not just the visible page.

### 24.13 — Reorder points

- [ ] Check the Back to inventory link is visible and returns to `/dashboard/inventory`; verify the emerald hover/focus and 44px touch target in Light/Dark and narrow mobile width.
- [ ] As Owner, open `/dashboard/inventory/settings/reorder-points`. Search exact QA SKU and a product-name substring; verify one match, clear search, no-match empty state, page totals, page reset on search, and Refresh preserving the current filter/page as intended.
- [ ] Record the QA product's original minimum/reorder values, its all-accessible-location current stock, the global `lowStockThreshold`, and dashboard reorder-pair count before editing. Do not assume the global threshold is zero.
- [ ] Frontend validation: try a negative integer, decimal, blank field, and `minimum > reorder`; each must show a clear error/toast and leave the saved server values unchanged. A truly empty PATCH body must be rejected by the API. Do not treat unchanged values as invalid: identical Save is an idempotent no-op and must not add an audit event.
- [ ] Save valid thresholds at `minimum = 4`, `reorder = 12` for `PH24-QA-TRANSFER-001` only if those values are valid relative to the current saved minimum and business threshold; otherwise choose `minimum = current minimum`, `reorder = max(current reorder + 1, global threshold + 1)` and write the actual values down. Confirm a success toast, row values, aggregate stock unchanged, and persistence after Refresh/reload.
- [ ] Open Low stock and filter that SKU. Effective thresholds are `max(product threshold, business threshold)`; `belowMinimum` is strict `<`, while reorder is inclusive `<=`. Reconcile each accessible location (including implicit-zero pairs) and verify a quantity exactly equal to a threshold lands in the correct bucket. The test must not change on-hand quantities.
- [ ] Confirm audit log records one `UPDATE_REORDER_POINTS` event with exact before/after values and actor for the real change; an unchanged Save creates no duplicate event. Verify `inventory.view` permits reading, `inventory.adjust` is required to save, and backend rejects a different-business/inactive product ID.
- [ ] Restore the exact original thresholds and verify the prior Low stock rows and dashboard pair total return. Confirm the restoration is audited as a second change, then record both audit entries and the final values.
- [ ] Verify a concurrent conflicting update returns the documented refresh/retry response and cannot leave `minimum > reorder`.

### 24.14, 24.16–24.21 — Security, integrity, audit and final reconciliation

- [ ] Permission matrix: no `inventory.view`; `inventory.view` only; `inventory.adjust`; `inventory.transfer`; each permission alone must expose only its allowed screens/actions, and backend must independently reject forbidden calls.
- [ ] Location matrix: Owner/Admin all active locations; staff with one and multiple assigned locations; no assignment; inactive/unassigned location; cross-business product/location/record IDs. Verify dashboard, queue, report and mutation scopes agree.
- [ ] After every successful stock-changing action, compare before/after StockBalance against all movements; each posted quantity changes exactly once. Draft/rejected/failed/stale/duplicate actions change nothing. Source references and audit actor/timestamps must match.
- [ ] Reconcile integration sources: purchase receipt adds base units at destination; sales issue removes base units; accepted sales return restores stock; supplier return decreases stock; transfer nets to zero business-wide after complete receipt; adjustment/count variance moves the exact amount. Compare balances, movement history, valuation and Reports inventory snapshot.
- [ ] Check API validation and transaction rollback for multi-line records: if any line fails, no partial record, balance change, movement or success audit is left behind.
- [ ] Review Prisma/DB constraints and migration state; current schema does not enforce all inventory cross-tenant relationships at the database layer (24.21). Until safe backfill/composite constraints are implemented, record service-level tenant test results separately from DB-level enforcement.
- [ ] Confirm every visible filter survives apply/reset/back navigation as appropriate and page resets when filters change. Confirm toast text identifies the operation, failure reason and next step; never use toast alone as success evidence.
- [ ] Final responsive pass on dashboard, queue, create form, detail, reorder points and all report tabs in Light/Dark/Photo glass; keyboard focus, labels, overflow, loading/empty/error and no stale content.
- [ ] Re-run backend tests, backend/frontend TypeScript, relevant lint/build; record any environment lock/build limitation separately from code failure.

### Evidence to record for each tested workflow

For every numbered task, record: account/role and accessible locations; exact page/filter values; QA product SKU and starting quantity by location; submitted values; returned record number and status; ending balances; movement count/type/signed quantities/source reference; audit log event; screenshot or response text; and result (`PASS`, `FAIL` with bug, or `BLOCKED` with reason). A section is not green when only the screen/toast was observed.

### 24.22–24.23 — Cross-module source history and synthetic reconciliation data

Run `pnpm db:seed:phase24-inventory` from `genuine-backend` only after local PostgreSQL is listening on port 5432. The command is hard-gated to a local development database named `genuine`; inspect the emitted baseline and stop if `balanced` is not `true`. It creates only SKU `PH24-QA-TRANSFER-001` (`PH24 QA Transfer Reconciliation`), using the base unit and category from the existing PH25 unit-conversion QA product. It does not reset the fixture or modify existing product history on a rerun. **First attempt 17 Nov 2026:** blocked before any database query/write because localhost:5432 refused connection; no records changed. After PostgreSQL was started, the command succeeded. Evidence: MAIN 10 btl; PH21-BR-01 2 btl; opening adjustments `PH24-QA-OPEN-MAIN-001` (+10) and `PH24-QA-OPEN-BRANCH-001` (+2), both APPROVED; exactly two opening movements; signed movement net +12 equals balance total 12; `balanced: true`. No existing product/history was changed. This proves the seeded baseline only; browser presentation, valuation and subsequent operation references remain to be checked.

Expected baseline: `MAIN` has 10 base units, `PH21-BR-01` has 2, quantity value at the fixture buying cost is TSh 12,000, and two approved opening adjustment references each have exactly one positive `ADJUSTMENT` movement. Baseline movement net is +12 and equals summed balances. Existing reference histories are used as independent cross-module checks: PH25 Unit Conversion Check should reconcile its `PURCHASE +12`, `SALE -12`, and `SALE REVERSAL +12` movements to 12 currently on hand; PH21 Stock and Returns Test Product sales/accepted-return movements should reconcile to its location balances. Compare sources by SKU, location, signed base quantity, reference ID and current balance; do not compare unlike unit quantities or assume report snapshots are historical.

Using only `PH24-QA-TRANSFER-001`, then run the UI/API flow in order:

1. Create a pending +1 adjustment at MAIN: balance remains 10 and movement count is unchanged. Approve once: MAIN becomes 11 with exactly one `ADJUSTMENT +1` movement; a second approval is rejected and changes nothing.
2. Create a transfer of 3 from MAIN to PH21: DRAFT changes neither balance nor ledger. Send once: MAIN becomes 8 and one `TRANSFER -3` movement appears; resending is rejected.
3. Receive 1: transfer becomes PARTIAL, PH21 becomes 3 and gets exactly one `TRANSFER +1`. Receive remaining 2: transfer becomes COMPLETED, PH21 becomes 5 and gets exactly one `TRANSFER +2`. Business-wide transfer movement net is zero; total quantity remains 13. Repeating receipt is rejected without another movement.
4. Create and complete a physical count at PH21 showing 4 against snapshot 5: before POST, balance remains 5 and no movement is added. POST once: PH21 becomes 4 with exactly one `ADJUSTMENT -1` count-reference movement; duplicate POST changes nothing. Final MAIN 8 + PH21 4 = 12, and the full fixture movement net is 12 (+10 +2 +1 -3 +1 +2 -1).
5. Verify audit timeline contains product creation, both opening adjustments, manual adjustment create/approve, transfer create/send/each receive, and count create/complete/post with the expected actor and source IDs. Check valuation is TSh 12,000 initially; after these cost-neutral quantity operations it is TSh 12,000, subject to the app's exact costing-layer behavior. If valuation differs, reconcile layer costs before marking pass.

Keep this QA SKU clearly labeled. Do not use a real customer/supplier, and do not delete or reset it after movements exist; preserving that history is necessary for audit and idempotency checks. Existing business-wide KPIs will change by the new product and its stock, which is expected and must be identified as PH24 test data.

### Start now

Begin with **24.1 only** at `http://localhost:3000/dashboard/inventory`. Do not create an adjustment/transfer/count yet. First send the Stock overview KPIs and recent movements, and say which account/role and current location are selected. After that evidence is reconciled, proceed to **24.2** and then into the mutation flows above.
