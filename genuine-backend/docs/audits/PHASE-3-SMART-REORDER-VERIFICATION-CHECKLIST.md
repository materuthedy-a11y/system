# PHASE 3 SMART REORDER — INDEPENDENT VERIFICATION CHECKLIST

## A. Scope and audit instructions

Verify the Smart Reorder capability end-to-end: recommendation calculation, stock and
incoming-PO semantics, supplier recommendation, confidence classification, draft PO
creation safety, permissions/location isolation, and the Intelligence UI reorder tab.

**Rules:** audit only — no code changes, no migrations, no data changes. Do not trust
this document or the implementation report. Trace every number from query → formula →
response → UI. Verify formulas against real schema semantics, not comments.

**Key files:**

- `genuine-backend/src/intelligence/insights.service.ts` — `computeSuggestions`,
  `getReorderSuggestions`, `createDraftPurchaseOrders`
- `genuine-backend/src/intelligence/dto/insight.dto.ts` — `ReorderSuggestionsQueryDto`,
  `CreateDraftPurchaseOrdersDto`
- `genuine-backend/src/intelligence/insights.controller.ts` — `/insights/reorder-suggestions*`
- `genuine-backend/src/purchases/purchase.service.ts` — `createPurchaseOrder` (idempotency,
  location, supplier validation, approval lifecycle)
- `genuine-frontend/app/dashboard/intelligence/page.tsx` — reorder tab, filters, qty edit,
  draft PO action
- `genuine-frontend/lib/api/intelligence.ts`

---

## B. Demand & stock calculation

- [ ] Daily velocity = Σ|SALE `InventoryMovement.quantity`| last 30d ÷ 30, per
      product+location. Confirm SALE movements store negative quantity and `Math.abs`
      is required and correct.
- [ ] `available` = `StockBalance.quantity` (running balance, may be negative when
      `allowNegativeStock`). Verify `stockAnomaly` flag set when available < 0 and that
      `effectiveAvailable = max(0, available)` is used in the shortfall.
- [ ] `daysOfStock` uses `effectiveAvailable` (not raw negative) — verify.
- [ ] Demand window = `daily × (leadTimeDays + 7)` — the +7 is a review-period buffer;
      confirm this is the documented intent.
- [ ] Safety stock = `ceil(daily × leadTimeDays × 0.5)` — 50% of lead-time demand;
      confirm only when daily > 0 (zero demand → 0).
- [ ] `suggestedQuantity = max(0, ceil(demandWindow + safetyStock − effectiveAvailable − incoming))`.
      Verify the `calculation` object returned matches this formula exactly.
- [ ] Reorder trigger: `shortfall > 0 OR effectiveAvailable ≤ reorderLevel` — verify a
      product at reorder level with sufficient projected cover still appears (by design)
      and one with shortfall>0 always appears.
- [ ] Zero demand (no SALE movements): daily=0 → demandWindow=0, safetyStock=0,
      daysOfStock=null → still flagged only if `available ≤ reorderLevel`. Verify this
      does NOT spam suggestions for slow/dead stock.
- [ ] Negative stock: verify a negative balance produces a suggestion with
      `stockAnomaly=true` and the anomaly reason text.
- [ ] Inactive products (`status != 'ACTIVE'`) excluded via productMap filter.

## C. Incoming purchase orders

- [ ] Only POs with status `ORDERED` or `PARTIALLY_RECEIVED` count as incoming —
      verify DRAFT, CANCELLED, RECEIVED/COMPLETED excluded.
- [ ] Remaining per PO item = `item.quantity − Σ grnItems.(acceptedQuantity ?? receivedQuantity)`
      where `grn.status='ACCEPTED'` — verify relation path `items → grnItems → grn` and
      that partial deliveries reduce incoming correctly.
- [ ] No double-counting: same product+location on multiple POs sums; stock balance is
      NOT also decremented for incoming (it's not received yet — correct).
- [ ] `incomingCost` averages remaining qty × PO unitPrice for unit-cost estimate.

## D. Supplier recommendation & lead time

- [ ] Preferred supplier = `product.supplierId` when supplier isActive.
- [ ] Fallback: when no product.supplierId, most recent non-draft/non-cancelled PO's
      supplier is used — verify `purchaseOrderItem.findFirst` ordering by
      `purchaseOrder.orderDate desc`.
- [ ] Lead time = avg(expectedDeliveryDate − orderDate) per supplier over 365d,
      requires ≥2 samples, clamped 1–60, default 7 — verify.
- [ ] Confidence: HIGH requires daily>0 AND ≥3 lead samples; MEDIUM daily>0; else LOW.
- [ ] No invented prices: `estimatedUnitCost` = incoming PO avg price else
      `product.buyingPrice`; `estimatedOrderCost` labeled estimate.
- [ ] Products with no resolvable supplier → `supplierId/supplierName = null`; verify
      `createDraftPurchaseOrders` then REJECTS them (no silent skip).

## E. Location & permission security

- [ ] `getReorderSuggestions`: locationIds from `accessibleLocationIds`; unrestricted
      users get all active locations; restricted users only assigned; `query.locationId`
      must be accessible else 404.
- [ ] Empty accessible set → `{data: []}` (no fallthrough to all locations).
- [ ] `locQuery` filter applied per balance row — verify a restricted user cannot see
      other branches' suggestions.
- [ ] `createDraftPurchaseOrders`: `assertLocationAccess` per item +
      `PurchaseService.createPurchaseOrder` re-asserts; endpoint requires
      `purchases.create`.
- [ ] Inactive product rejected; product without supplier rejected with clear error.

## F. Draft PO safety

- [ ] Idempotency: `idempotencyKey = smart-reorder:{sha256(userId+notes+sorted items)}:{supplierId}:{locationId}`
      — verify identical retries return the existing PO via PurchaseService's
      idempotency path (same fingerprint check).
- [ ] Quantities aggregated per product within a supplier+location group.
- [ ] `unitPrice` = `product.buyingPrice` — verify this is the documented choice and
      assess vs latest purchase price.
- [ ] Notes prefixed "Smart reorder draft"; status DRAFT only; no auto-approve/send.
- [ ] Concurrency: two simultaneous identical requests → same idempotency key → one PO.
      Two different requests → separate POs (acceptable; document).
- [ ] Client can submit arbitrary quantities (not capped at suggestion) — verify this
      is intentional (user adjustment) and quantities >0 validated by DTO @Min(0.0001).

## G. UI verification

- [ ] Reorder tab: filter bar (search, urgency, confidence, supplier) works client-side.
- [ ] Urgency buckets: CRITICAL ≤3d, SOON 4–14d, OK = reorder-level-only/null days.
- [ ] Editable quantity input appears only for selected rows; invalid/≤0 filtered out
      before submit.
- [ ] "Create draft PO (n)" disabled at 0 selection; success toast shows PO count.
- [ ] Table columns: product+SKU, location, available, incoming, daily sales, days-left
      badge colors, suggested qty (editable when selected), supplier+lead time, est. cost,
      reason+confidence.
- [ ] `stockAnomaly` rows: verify UI surfaces negative stock acceptably (check reason text).
- [ ] Empty state, loading spinner, error toast present.
- [ ] Dark mode classes consistent; responsive overflow-x on table.
- [ ] Insights tab unaffected by reorder changes (regression).

## H. Performance

- [ ] computeSuggestions: 6 parallel queries + 1 sequential PO-history query + per-row
      supplier fallback `findFirst` — **N+1 risk**: verify fallback only fires for
      products without supplierId (minority) and consider batching if hot.
- [ ] `balances`/`movements` queries bounded by locationIds + 30d window.
- [ ] `histPos` bounded to 365d.
- [ ] Reorder row cap: `limit` default 100, max 500.

## I. Regression

- [ ] `npx tsc --noEmit` clean backend + frontend.
- [ ] `npx jest` — 173/173 pass.
- [ ] Existing purchase order creation/approval/GRN flows untouched.
- [ ] Phase 1 & 2 behavior unchanged (insights, payments, sales).

## J. Limitations to confirm

- [ ] No MOQ fields exist in schema — MOQ constraints NOT implemented (document).
- [ ] No reserved-stock concept in schema — treated as 0 (document).
- [ ] Multiple-supplier products: only one supplier recommended (preferred or last-used);
      no comparison matrix (document for Phase 4).
- [ ] Inter-branch transfer suggestions NOT implemented (Phase 4 scope).
- [ ] Reorder runs live per request (no persistence/caching) — document freshness vs cost.

## K. Scorecard

| Area | Result | Evidence | Residual risk |
|---|---|---|---|
| Demand/stock formula | | | |
| Incoming PO handling | | | |
| Supplier recommendation | | | |
| Lead time/safety stock | | | |
| Confidence model | | | |
| Location/permissions | | | |
| Draft PO idempotency | | | |
| UI/UX | | | |
| Performance | | | |
| Regression | | | |

**Verdict:** READY FOR COMPREHENSIVE TESTING / NEEDS REMEDIATION.

## L. Verification-Gate Addendum (post-audit fixes)

- [x] Detector scans converted to DB-side `groupBy` aggregation (no silent `take`
      truncation): lowMargin (productId), stockout velocity (productId+locationId,
      negated SALE sums), deadStock (distinct SALE products), customerChurn
      (customerId with _count/_sum/_max), expiry bounded+ordered.
- [x] Reorder math extracted to pure `computeReorderMath` (`reorder-math.ts`) —
      single source of truth; covered by `reorder-math.spec.ts` (11 tests).
- [x] PO creation race: P2002 on `[businessId,idempotencyKey]` now caught and the
      winning draft returned instead of a 500.
- [x] Verified: PO incoming statuses = ORDERED/PARTIALLY_RECEIVED only;
      DRAFT/CANCELLED/FULLY_RECEIVED/CLOSED excluded; demand counts type='SALE'
      movements only (returns/transfers/adjustments excluded by type filter).
- [ ] STILL OPEN: cashFlowDetector overdue-invoice scan unbounded (low risk —
      overdue set is naturally small); supplierRisk PO scan unbounded within 180d.
