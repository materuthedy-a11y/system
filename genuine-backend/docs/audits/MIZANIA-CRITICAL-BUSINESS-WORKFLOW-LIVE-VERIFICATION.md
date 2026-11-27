# MIZANIA — CRITICAL BUSINESS WORKFLOW LIVE VERIFICATION

## 1. Database Isolation — VERIFIED

- Target: PostgreSQL `genuine` DB, **schema `test`** (created via `CREATE SCHEMA test`).
- `public` schema never touched; no destructive ops outside `test`.
- `.env.test` holds the override URL; both live specs refuse to run unless the URL
  contains `schema=test`.
- Seed: `scripts/seed-test.mjs` — `TRUNCATE ... CASCADE` on `test` tables only,
  then reseeds (2 businesses, locations, users+roles+permissions, suppliers,
  customers, products incl. edge cases, 30-day movement history, invoices,
  payments, returns, POs/GRNs, adjustments, expenses).

## 2. Harness

`src/business-workflows.live.spec.ts` — instantiates the REAL services
(`SalesService`, `PaymentsService`, `InventoryService`, `PurchaseService`) against a
real `PrismaClient` on the test schema. Notification service is a Proxy stub
(resolved promises); logger is silent. Runs only with `RUN_LIVE_DB=1`.

`src/intelligence/intelligence.live-db.spec.ts` — Phase 2/3 live spec (7 tests).

## 3. LIVE TESTED — Results (13/13 PASS)

### Sales (`SalesService`)
- ✅ Create invoice → DRAFT, `subtotal=6000`, `totalAmount=subtotal+tax` consistent,
  single line item; **no stock movement before issue**.
- ✅ Issue → status ISSUED, StockBalance 500→495, SALE `InventoryMovement` written
  with invoice reference, `balance=totalAmount`.
- ✅ Invalid product rejected.

### Payments (`PaymentsService`)
- ✅ Partial payment → `totalPaid`/`balance` updated correctly.
- ✅ Full settlement → `balance=0`.
- ✅ `voidPayment` → payment `VOIDED`+`voidedAt`, invoice balance restored.

### Returns & Refunds (`SalesService`)
- ✅ Return qty 10 against 4 sold → **rejected** (over-return guard).
- ✅ Self-authorization → **ForbiddenException** (Phase 1 rule verified live).
- ✅ staffA (locA1 manager, non-creator) authorized → received → REFUND settled →
  StockBalance +2 restored, OUTFLOW refund `Payment` created.
- ✅ Unpaid invoice REFUND correctly rejected ("no refundable credit balance") —
  refund requires overpaid/credit state.

### Purchases & GRN (`PurchaseService`)
- ✅ PO create → DRAFT; approve by manager → ORDERED/APPROVED;
  partial GRN (4/10) → `acceptGRN` → ACCEPTED, StockBalance +4, PURCHASE movement.

### Idempotency / Concurrency
- ✅ Two simultaneous `createPurchaseOrder` with same `idempotencyKey` → **same PO,
  exactly 1 row** (unique constraint + fingerprint path verified live).
- ✅ Smart-reorder draft PO path (prior spec): concurrent identical → 1 DRAFT PO;
  changed qty → new PO.

### Phase 2 Intelligence (live spec)
- ✅ All detectors produce expected types; dedupe stable on re-run;
  lifecycle transitions + terminal guards; location scoping for restricted user.

### Phase 3 Smart Reorder (live spec)
- ✅ Exact formula verified (P-LOW: lead 11, window 36, safety 11, avail 12,
  incoming 20 → qty 15); triggers, zero/negative demand, inactive exclusion,
  no-supplier rejection.

## 4. Security Verified Live

- Self-approval blocks (return authorize, confirmed).
- Location-restricted user sees only managed-branch insights.
- Service-level permission enforcement (`payments.create` required for REFUND settle —
  initially failed for permission-less seeded user, passed after grants).

## 5. Defects Found This Stage

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| W-01 | P3 | Seed customers used invalid `paymentTerms` ('CASH'/'CREDIT'); valid set is NET-*/COD/PREPAID | Seed fixed |
| W-02 | P3 | Seed products lacked `ProductUnit`/`defaultUnitId` → PO creation rejected | Seed fixed |
| W-03 | P3 | Notification stub missing `checkStockLevel` | Proxy stub |
| W-04 | P3 | Test-order coupling: workflow spec mutated P-LOW stock affecting reorder spec | PO/GRN test moved to P-DISC |

**No application defects found.** All failures were test-harness/seed issues.

## 6. CODE AUDITED (not live-executed)

- Concurrent sales overselling (bizA allows negative stock by design; bizB
  `allowNegativeStock=false` path not exercised live).
- Cross-business isolation at API boundary (unit specs cover authorization util;
  no live two-business transaction attempted).
- Frontend/browser UI, mobile, load/performance — unchanged from prior report.

## 7. Commands to Reproduce

```bash
cd genuine-backend
node scripts/seed-test.mjs
RUN_LIVE_DB=1 npx jest src/business-workflows.live.spec.ts src/intelligence/intelligence.live-db.spec.ts
RUN_LIVE_DB=1 npx jest --silent   # full suite incl. live specs
```

## 8. Regression

`RUN_LIVE_DB=1 npx jest --silent` → **197/197 PASS** (20 suites).

## Verdict

**A — Critical workflows verified with strong evidence** for sales, payments,
returns/refunds, purchases/GRN, inventory effects, idempotency, self-approval,
location scoping, and the Phase 2/3 intelligence layer — all against real Postgres.
Remaining gaps (browser UI, load, cross-business API-boundary live test) are
documented limitations, not defects.
