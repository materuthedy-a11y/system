# PHASE 2 INTELLIGENCE — INDEPENDENT VERIFICATION CHECKLIST

## A. Scope and audit instructions

**Purpose.** Verify the Phase 2 implementation: the unified Insight Engine (detectors,
lifecycle, deduplication, permissions), the premium Intelligence UI, the Smart Reorder
engine with draft-PO creation, and the supporting schema/migration/permissions work.

**Rules for the auditor.**

- Do NOT trust this document or the implementation report. Inspect actual code, schema,
  migrations, tests, and runtime behavior.
- AUDIT ONLY: do not modify code, create files, run migrations, or alter data.
- Passing tests do not prove correctness. Trace each detector's query → calculation →
  persisted insight → UI rendering end-to-end.
- Verify every formula against the real schema semantics (e.g., `InventoryMovement.quantity`
  sign conventions, `StockBalance` vs ledger, PO/GRN received quantities).
- Distinguish verified financial figures from estimates; check that estimates are labeled.

**Key files under audit:**

- `prisma/schema.prisma` — `Insight` model (~line 1480+), `Business.insights` relation
- `prisma/migrations/20261127000000_phase2_insights/migration.sql`
- `src/intelligence/detectors.ts` — all 10 detectors
- `src/intelligence/insights.service.ts` — engine, lifecycle, reorder, draft PO
- `src/intelligence/insights.controller.ts`, `src/intelligence/dto/insight.dto.ts`
- `src/intelligence/intelligence.module.ts`, `src/app.module.ts` registration
- `src/auth/auth.service.ts` — `insights.view`/`insights.manage` permissions (~line 890,
  Manager grants ~1036, dependency map ~1145)
- `genuine-frontend/lib/api/intelligence.ts`
- `genuine-frontend/app/dashboard/intelligence/page.tsx`
- `genuine-frontend/app/dashboard/layout.tsx` — nav entry (~line 440, group ~452)

---

## B. Insight engine architecture

- [ ] `Insight` model exists with: unique `[businessId, dedupeKey]`, indexes on
      `[businessId, status, severity]`, `[businessId, type]`, `[businessId, locationId]`,
      cascade delete on business, all lifecycle timestamp fields.
- [ ] Migration SQL matches the Prisma model exactly (columns, types, defaults, indexes,
      FK). Confirm it was applied (`_prisma_migrations` row exists; table exists in DB).
- [ ] `Insight.dedupeKey` design: verify each detector produces a STABLE key per
      entity+period bucket so re-runs update rather than duplicate.
- [ ] Verify upsert logic in `runDetection`: existing insight → updates evidence/impact/
      severity/summary + `lastSeenAt`; does NOT reset status except EXPIRED→ACTIVE.
      Confirm ACKNOWLEDGED/DISMISSED/RESOLVED insights are not resurrected or flooded.
- [ ] Verify expiry logic: `updateMany status='ACTIVE' AND lastSeenAt < runStartedAt →
      EXPIRED` — confirm this cannot expire insights created by a *different* run scope
      (detectors always run business-wide with `locationIds: null`).
- [ ] Verify detector failure isolation: one detector throwing must not abort the run
      (try/catch per detector in `runDetection`).
- [ ] Verify cron `@Cron('30 4 * * *') scheduledRun` iterates active businesses and
      catches per-business errors.
- [ ] Verify `POST /insights/run` requires `insights.manage`.
- [ ] Verify severity values are limited to INFO/LOW/MEDIUM/HIGH/CRITICAL and each
      detector's severity assignment follows a documented rule (not arbitrary).
- [ ] Verify lifecycle transitions: ACTIVE→ACKNOWLEDGED/DISMISSED/RESOLVED only;
      invalid transitions rejected with ConflictException; timestamps+actor persisted.
- [ ] Verify `InsightActionDto.note` handling appends to `detail` — check for injection/
      unbounded growth concerns (minor).
- [ ] Check for N+1 or unbounded queries in detectors: several detectors load ALL invoices/
      movements for the business — assess performance at scale; verify `take`/limits exist
      where needed (e.g., flagged lists capped at 10–15).

## C. Detector correctness (verify each against real data semantics)

For EVERY detector: run it against known data (or inspect queries) and confirm the
insight's numbers match a hand calculation.

### C1. SALES_DECLINE
- [ ] Net revenue = issued invoices (not DRAFT/CANCELLED) minus RECEIVED/COMPLETED returns,
      over last 30d vs prior 30d.
- [ ] Guard conditions: requires `prevRevenue >= 1` AND `prevCount >= 3` — no insight on
      insufficient history.
- [ ] Decline threshold ≥20%; HIGH ≥40%. Verify severity mapping.
- [ ] Verify `SalesReturn.returnDate` is the correct date field (not createdAt).
- [ ] Verify location scoping: detectors run business-wide (`locationIds: null`); confirm
      this is intentional and that per-location scoping was deliberately omitted — assess
      whether locationId is always null on this insight (check evidence).

### C2. LOW_MARGIN_PRODUCT
- [ ] Margin formula = (line revenue − qty × product.buyingPrice) / revenue; flagged <8%.
- [ ] Uses last 90 days of non-draft/non-cancelled invoice items.
- [ ] Verify `detail` explicitly labels the estimate as directional (not audited profit).
- [ ] Check `SalesInvoiceItem.total` is the correct post-discount line total field.

### C3. EXCESSIVE_DISCOUNT
- [ ] Effective discount = discountAmount ÷ subtotal > 25%; last 30 days; top 10.
- [ ] Verify HIGH severity when ≥5 flagged invoices.
- [ ] Confirm evidence lists invoice IDs (drill-down traceability).
- [ ] Confirm the detector does NOT accuse users — check copy is factual.

### C4. STOCKOUT_RISK
- [ ] Velocity = |SALE movement quantity| over 30d ÷ 30 per product+location.
- [ ] daysOfStock = quantity ÷ dailyVelocity; flags qty≤0, ≤14d, or ≤reorderLevel.
- [ ] Verify `InventoryMovement.quantity` sign convention for SALE (negative) — the
      detector uses `Math.abs`; confirm this is correct for all movement types queried.
- [ ] Confirm `detail` honestly states incoming POs are NOT subtracted.
- [ ] Verify stockBalance `quantity` semantics (can it be negative when
      allowNegativeStock?).

### C5. DEAD_STOCK
- [ ] Positive stock AND zero SALE movements in 90 days.
- [ ] Value = qty × buyingPrice; threshold for MEDIUM severity (≥500000) — confirm this
      hardcoded currency amount is acceptable or should be configurable.
- [ ] Verify it uses DISTINCT productIds from SALE movements (not count).

### C6. EXPIRY_RISK
- [ ] Sums ALL batch-tracked movements (any type) per product+location+batch+expiryDate;
      remaining qty > 0 and expiry ≤ 30 days.
- [ ] **Critical check:** verify `InventoryMovement.expiryDate`/`batchNumber`/`unitCost`
      are populated on PURCHASE receipts AND that SALE movements of the same batch carry
      the same batchNumber+expiryDate (otherwise net-remaining math is wrong).
- [ ] Verify expired batches (expiryDate < now) are handled — currently `lte: horizon`
      includes already-expired; should they produce insights? Assess.
- [ ] Confirm recommendation never suggests selling expired stock.

### C7. CUSTOMER_CHURN_RISK
- [ ] ≥3 lifetime invoices AND last invoice >60 days ago; top 10 by revenue.
- [ ] Verify `Customer.status='ACTIVE'` filter and `isActive` — confirm field semantics.
- [ ] Confirm `detail` labels it a heuristic, not a probability.

### C8. SUPPLIER_RISK
- [ ] ≥3 POs in 180d; late = first ACCEPTED GRN receivedDate > expectedDeliveryDate;
      flags lateRate ≥34% or avgDelay ≥5 days.
- [ ] Verify POs without expectedDeliveryDate or without GRNs are excluded from delay math
      but still counted in `total` — assess whether that skews lateRate.
- [ ] Verify `PurchaseOrder.orderDate`, `expectedDeliveryDate`, GRN `receivedDate` fields.

### C9. CASH_FLOW_WARNING
- [ ] Overdue = ISSUED/PARTIALLY_PAID/OVERDUE invoices, balance>0, dueDate<now.
- [ ] Warning condition: `net<0 OR overdueTotal > |net|*2` — verify this logic is sensible
      (e.g., net=0, overdue>0 → `overdueTotal > 0` true → warns; net positive large → may
      not warn — is that intended?).
- [ ] Verify Payment.direction='INFLOW'/'OUTFLOW' and status filter.
- [ ] Confirm copy says actuals, not bank balances/forecast.

### C10. ACTIVITY_ANOMALY
- [ ] Per-user 30d counts: voided payments ≥3, cancelled invoices ≥5, adjustments ≥8,
      authorized returns ≥5.
- [ ] Verify `Payment.voidedAt`, `SalesInvoice.cancelledBy/cancelledAt`,
      `StockAdjustment.createdBy`, `SalesReturn.authorizedBy` fields.
- [ ] Verify location scoping via relation filters on payments (invoice/po/expense).
- [ ] Confirm copy is factual, non-accusatory; userId stored in evidence.

## D. Permissions & location security

- [ ] `insights.view` and `insights.manage` exist in `permissionsData`; Manager granted
      both; Salesperson NOT granted either.
- [ ] Owner/Admin receive all permissions automatically (createdPermissions map).
- [ ] `insights.manage` dependency on `insights.view` in normalizeGrants.
- [ ] Permission sync runs at login — new keys provision for existing businesses.
- [ ] **List/get/summary filtering:** restricted users (accessibleIds non-null) see ONLY
      insights with `locationId IN accessibleIds` — business-wide insights (locationId
      null) are hidden from them. Verify this is the implemented behavior and assess
      whether hiding business-wide insights from branch managers is acceptable or a gap.
- [ ] `filter.locationId` validated via `assertLocationAccess` server-side.
- [ ] Lifecycle transitions (acknowledge/dismiss/resolve) enforce the same location
      scoping via `getInsight`-style where clause.
- [ ] Reorder suggestions: locationIds derived server-side from `accessibleLocationIds`;
      `query.locationId` must be within accessible set; empty accessible set → empty
      result (verify no fallthrough to all locations).
- [ ] `createDraftPurchaseOrders` calls `assertLocationAccess` per item AND delegates to
      `PurchaseService.createPurchaseOrder` (which re-asserts + enforces purchases.create
      semantics). Verify no bypass.
- [ ] `POST /insights/reorder-suggestions/create-po` requires `purchases.create`.

## E. Smart reorder engine

- [ ] Velocity: SALE movements last 30d ÷ 30 per product+location.
- [ ] Incoming: for POs in ORDERED/PARTIALLY_RECEIVED, remaining = item.quantity −
      Σ grnItems.(acceptedQuantity ?? receivedQuantity) on ACCEPTED GRNs — verify the
      relation path `items → grnItems → grn.status` is correct.
- [ ] Lead time: avg(expectedDeliveryDate − orderDate) per supplier over 365d, requires
      ≥2 samples else default 7d, clamped 1–60.
- [ ] Formula: `demandWindow = daily × (leadTime + 7)`; `safetyStock = ceil(daily ×
      leadTime × 0.5)`; `shortfall = demandWindow + safetyStock − available − incoming`;
      `suggestedQuantity = ceil(shortfall)`; also triggers when `available ≤ reorderLevel`.
- [ ] Verify no double-counting: `StockBalance.quantity` vs movement sums; incoming POs
      counted once; sales already deducted from balance.
- [ ] Supplier recommendation: only `product.supplierId` if supplier active; otherwise
      null (no fabricated recommendation).
- [ ] Unit cost: incoming PO price if present else `product.buyingPrice`.
- [ ] Confidence: HIGH requires velocity>0 AND ≥3 lead-time samples; MEDIUM velocity>0;
      LOW otherwise — verify mapping.
- [ ] `estimatedOrderCost = suggestedQuantity × unitCost` — verify labeled as estimate.
- [ ] Sorting: daysOfStock asc (null→9999) then suggestedQuantity desc; limit default 100,
      max 500.
- [ ] **Draft PO safety:** creates DRAFT POs only via existing `createPurchaseOrder`;
      groups by supplier+location; merges duplicate product lines; uses
      `product.buyingPrice` as unitPrice (verify this is defensible vs latest PO price);
      products without `supplierId` rejected; notes prefixed "Smart reorder draft".
- [ ] Verify PO requires approval before ordering (existing DRAFT→ORDERED flow) — no
      auto-submission.
- [ ] Duplicate-draft risk: two rapid create-po calls could create duplicate DRAFT POs —
      check whether idempotencyKey is used (it is NOT passed) — assess risk.

## F. UI verification

- [ ] Page at `/dashboard/intelligence`; nav item visible only with `insights.view`.
- [ ] Severity strip filters list; counts match `bySeverity` summary.
- [ ] Tabs: Insights / Smart reorder.
- [ ] Insight cards show severity, category, title, summary; expand shows detail,
      evidence (≤12 entries), recommendation, timestamps.
- [ ] Actions (acknowledge/resolve/dismiss) only when `insights.manage` and status ACTIVE;
      call correct endpoints; refresh list.
- [ ] Filters: severity (via strip), category, status, search q, pagination.
- [ ] Reorder table: checkbox selection, suggested qty, days-left badge colors,
      supplier + lead time, est. cost, reason + confidence; "Create draft PO (n)" disabled
      when nothing selected; calls create-po endpoint; success toast.
- [ ] Empty/loading/error states present; no console errors.
- [ ] Theme: verify dark mode classes used consistently (no hardcoded light-only colors).
- [ ] Accessibility: buttons have labels/aria, table headers semantic, keyboard navigable.
- [ ] Responsive: table has min-width + overflow-x; cards wrap on mobile.
- [ ] Check `lib/api/intelligence.ts` unwrap/envelope handling matches backend response
      shape (`{data,total,page,limit,summary}`).

## G. Regression audit

- [ ] Existing 173 backend tests still pass post-Phase-2 (`npx jest`).
- [ ] `tsc --noEmit` clean on both backend and frontend.
- [ ] No changes to existing sales/purchase/inventory/payment business logic (diff review).
- [ ] `prisma generate` output committed-compatible; client regenerated.
- [ ] Migration is additive-only; no existing tables/columns altered.
- [ ] App boots without DI errors (IntelligenceModule imports PurchasesModule — check for
      circular dependency: PurchasesModule must not import IntelligenceModule).
- [ ] Cron registration doesn't break tests or duplicate in multi-instance deploys
      (document single-instance assumption).

## H. Performance audit

- [ ] Detector query volumes: salesDecline does 4 aggregate queries; lowMargin loads ALL
      invoice items in 90d (unbounded — flag risk); churn loads ALL invoices ever;
      expiry loads ALL expiry-tracked movements ever (unbounded — flag risk).
      Recommend bounding by date window/index.
- [ ] `runDetection` does per-draft findUnique+update/create sequentially — O(n) queries;
      acceptable for ≤~100 drafts/run; verify caps (each detector ≤15 drafts).
- [ ] Reorder suggestions: 6 parallel queries + 1 sequential supplier-history query —
      fine for typical catalogs; verify no N+1 in PO item loop.
- [ ] Insight list paginated (max 100); summary uses groupBy — fine.
- [ ] Cron runs daily per business sequentially — fine at current scale; note for growth.

## I. Known limitations to verify/disclose

- [ ] Customer intelligence beyond churn detector (RFM, CLV, credit exposure) was NOT
      separately implemented — confirm whether existing `/analytics/customers` covers it
      and document the gap.
- [ ] Expiry/stockout NOT pushed through NotificationsService — insights are pull-based
      only; confirm no notification spam was introduced and document as deferred.
- [ ] `insights.view`/`manage` for custom roles require admin grant (documented behavior).
- [ ] Location-restricted users cannot see business-wide insights — confirm acceptable.
- [ ] Reorder `unitPrice` uses `buyingPrice` not negotiated supplier price — documented.

## J. Evidence record format

For each check record: item, PASS/FAIL/PARTIAL/NOT VERIFIED, file+function+lines,
test/command, observed behavior, risk, explanation, remediation.

## K. Scorecard

| Area | Result | Evidence | Residual risk |
|---|---|---|---|
| Insight engine core | | | |
| Detectors (10) | | | |
| Permissions/location | | | |
| Smart reorder | | | |
| Draft PO safety | | | |
| Intelligence UI | | | |
| Migration/schema | | | |
| Performance | | | |
| Regression | | | |

**Verdict:** READY FOR NEXT PHASE / NEEDS REMEDIATION.

---

## L. Phase 2 Stabilization Addendum (post-implementation fixes)

The following fixes were applied AFTER the initial Phase 2 build; verify each:

- [ ] `lowMarginDetector`: invoice items query bounded with `take: 50000` + `orderBy id`.
- [ ] `customerChurnDetector`: invoice scan bounded to last 730 days, `take: 100000`.
- [ ] `expiryRiskDetector`: movement scan bounded to expiryDate within last 365 days,
      `take: 50000`.
- [ ] Insight reactivation: RESOLVED insights now return to ACTIVE when the condition
      persists (`EXPIRED` and `RESOLVED` → ACTIVE; DISMISSED/ACKNOWLEDGED unchanged).
      Verify this matches intended lifecycle (resolved-but-recurring issues resurface).
- [ ] Reorder engine: `calculation` evidence object + `stockAnomaly` flag added;
      negative stock uses `effectiveAvailable = max(0, available)`; supplier fallback to
      most recent PO supplier when `product.supplierId` is null.
- [ ] Draft PO creation now passes a deterministic `idempotencyKey` derived from
      user+items+notes — verify duplicate submissions cannot create duplicate POs.
- [ ] Smart reorder UI: urgency/confidence/supplier/search filters + editable
      quantities before PO creation.
- [ ] Remaining known gaps (unchanged): detectors' queries still scan bounded-but-large
      datasets; no push notifications for insights; customer RFM/CLV deferred to Phase 4.
