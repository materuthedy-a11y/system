# PHASE 1 HARDENING — INDEPENDENT VERIFICATION CHECKLIST

## A. Scope and audit instructions

**Purpose.** This checklist verifies the Phase 1 hardening implementation for the Mizania
Business Suite (`genuine-backend` NestJS/Prisma + `genuine-frontend` Next.js): price-override
protection, branch/location access security, returns/refunds/credit-note integrity, payment
void/reconciliation safety, and self-approval prevention plus dead-code cleanup.

**Rules for the auditor.**

- Do NOT trust this document's claims or the implementation report. Independently inspect the
  actual code, Prisma schema, migrations, tests, and runtime behavior.
- This is an AUDIT ONLY. Do not modify code, do not create files, do not run migrations, do not
  alter data.
- Passing tests do NOT prove security. Trace each workflow end-to-end: UI → controller →
  service → transaction → database state.
- Distinguish real enforcement from UI hiding, comments, or dead fields.
- For every check record: item, PASS / FAIL / PARTIAL / NOT VERIFIED, evidence (file path,
  function/endpoint, line numbers), test name or command, observed behavior, risk level,
  explanation, and recommended remediation on failure.

**Key files under audit:**

- `src/sales/sales.service.ts`, `src/sales/sales.controller.ts`, `src/sales/dto/*`
- `src/payments/payments.service.ts`, `src/payments/payments.controller.ts`,
  `src/payments/expenses.service.ts`, `src/payments/expenses.controller.ts`
- `src/inventory/inventory.service.ts` (stock adjustment approval)
- `src/purchases/purchase.service.ts` (PO approval)
- `src/auth/auth.service.ts` (permission catalog ~line 843+, role seeds ~977+, dependency map ~1108+)
- `src/common/utils/location-access.util.ts`, `src/common/guards/permission.guard.ts`
- `prisma/schema.prisma` (Payment, SalesReturn, SalesInvoice models)

---

## B. Item checklists

### ITEM 1 — Price Override Protection

- [ ] Identify the authoritative price source: confirm `Product.sellingPrice` is the list price
      and that `prepareLines` converts client `unitPrice` (per selected unit) to
      `baseUnitPrice = unitPrice / conversionFactor`.
- [ ] Verify `prepareLines` flags `priceOverridden` when `|baseUnitPrice − sellingPrice| > 0.0001`.
- [ ] Verify `createSalesInvoice` calls `assertPermission(tx, businessId, userId,
      'sales.price_override')` inside the transaction when any line is overridden.
- [ ] Verify `updateSalesInvoice` enforces the same check **only when `dto.items` is supplied**
      (unchanged stored lines are grandfathered — confirm this is intentional and cannot be
      exploited: prices can only change via `items`).
- [ ] Verify a user WITHOUT `sales.price_override` cannot set a custom price via crafted API
      payload on create OR update.
- [ ] Verify a user WITH `sales.price_override` (Owner/Admin/Manager seeds) retains the
      capability.
- [ ] Verify the `sales.price_override` permission exists in `permissionsData` and is granted
      to Manager; confirm Salesperson does NOT receive it.
- [ ] Verify permission auto-provisioning: `_createDefaultRolesAndPermissions` runs at login
      (`auth.service.ts` ~line 292) and creates missing permission rows for existing businesses.
- [ ] Verify discount caps still work: `assertDiscountLimit` requires `sales.discount` and
      enforces role-percentage ceilings; confirm price overrides cannot bypass discount caps
      (an overridden price is a separate control — assess whether below-list pricing via
      override circumvents the discount ceiling and whether that is acceptable policy).
- [ ] Verify negative prices remain impossible (DTO `@Min(0)`, `discount > gross` check,
      `totalAmount < 0` check).
- [ ] Verify tax/total math unchanged: `subtotal − discount + tax = totalAmount`,
      `money()` 2dp rounding.
- [ ] Verify `requiresApproval` DTO field status: it is declared but unused; confirm issue
      (`POST /sales/invoices/:id/issue`) still requires `sales.approve` — document whether the
      unused field is acceptable or should be removed/wired.
- [ ] Edge cases to probe: price equal to list (no flag), price 1 cent below list (flagged —
      is the 0.0001 epsilon too tight/loose?), unit conversion factor ≠ 1, wholesale customers.

### ITEM 2 — Branch / Location Access Security

- [ ] Verify `assertLocationAccess` is called in `createSalesPayment` (invoice.locationId).
- [ ] Verify it is called in `issueSalesInvoice`, `updateSalesInvoice` (both existing and
      target locationId), and `cancelSalesInvoice`.
- [ ] Verify `payExpense` (payments.service) checks `expense.locationId` when set.
- [ ] Verify `reconcilePayment` and `voidPayment` resolve the payment's linked location via
      `invoice/po/expense.locationId` and assert access; confirm payments with no linked
      document (referenceType 'Other') have no location constraint — assess acceptability.
- [ ] Verify return endpoints are covered indirectly via `getSalesReturnById` location
      scoping (404 for inaccessible) — confirm `authorizeSalesReturn`, `receiveSalesReturn`,
      `rejectSalesReturn`, `settleSalesReturn` all call it before mutating.
- [ ] Sweep for OTHER unprotected mutations: check purchase payment creation, GRN accept,
      transfer send/receive, adjustment approve, physical count post, payment create paths —
      confirm each either asserts location or is intentionally business-wide.
- [ ] **Analytics/reports:** determine whether `GET /analytics/*` and
      `GET /payments/reports/*` respect location permissions. Check whether
      `accessibleLocationIds`/`locationId` filtering exists in `analytics.service.ts` and the
      finance report methods. Record PARTIAL/FAIL honestly if business-wide data is still
      visible to location-restricted users.
- [ ] Test matrix: user assigned Branch A only → access A (pass), attempt B via invoice ID,
      payment ID, expense ID, query param `locationId`, nested resources (must 403/404).
      Owner/Admin (null accessibleIds) → unrestricted. Multi-location manager → only assigned.
- [ ] Confirm failures return 403/404 and do not leak data (no partial objects).

### ITEM 3 — Returns, Refunds & Credit Notes

- [ ] Verify refund payments are created ONLY via `POST /sales/returns/:id/settle` with
      `resolution: 'REFUND'`, permission `payments.create` (service-level `assertPermission`).
- [ ] Verify refund `Payment` rows have `direction='OUTFLOW'`,
      `referenceType='SalesReturn'`, `referenceId=<returnId>`, `invoiceId=null` — confirm
      this deliberate non-linkage and that all balance computations account for it.
- [ ] Verify `invoicePaymentState` (sales.service) adds back refunds:
      `balance = total − paid − returned + refunded`.
- [ ] Verify `recomputeInvoice`, `refreshReferencePaymentState`, `resolvePaymentReference`
      (payments.service) apply the same refund-aware formula — check for drift between the
      two services.
- [ ] Verify `mapInvoice`/`getSalesInvoiceById`/`getAllSalesInvoices` include
      `refundsIssued` and correct `balance`; confirm `invoiceInclude.returns` selects `id`.
- [ ] Verify over-refund is impossible: `amount <= creditOwed` where
      `creditOwed = max(0, −balance)`; concurrent settles serialize on invoice+return
      `FOR UPDATE` locks.
- [ ] Verify duplicate refunds cannot occur: second settle sees reduced creditOwed →
      rejected; idempotency of the endpoint itself (no Idempotency-Key — assess risk).
- [ ] Verify CREDIT resolution requires `sales.approve` and only writes an audit entry —
      confirm negative invoice balance correctly reduces `customerOutstanding` (acts as
      customer credit) and cannot be double-spent.
- [ ] Verify settlement only allowed on `RECEIVED`/`COMPLETED` returns; cancelled invoices
      rejected.
- [ ] Verify refund respects accounting-period lock (`assertAccountingPeriodOpen` on
      paymentDate) and payment-method `requiresReference`.
- [ ] Verify cash-flow correctness: OUTFLOW refund reduces cash-on-hand in
      `getCashFlowReport`/`getFinancialSummary` (check `paymentDirection` handles
      `direction='OUTFLOW'` with referenceType 'SalesReturn').
- [ ] Verify reports: receivables ageing/trial balance clamp negatives — confirm no
      regression where refund makes a still-positive balance wrong (argue mathematically
      or find counterexample).
- [ ] Verify stock restoration unchanged: `CUSTOMER_RETURN` movements at original unitCost,
      FEFO batch re-allocation intact.
- [ ] Verify return quantity caps unchanged (prior open returns counted).
- [ ] Edge cases: return on unpaid invoice (creditOwed=0 → refund rejected), partial refund,
      refund then additional return, return after invoice cancel attempt.

### ITEM 4 — Payment Void & Reconciliation Safety

- [ ] Verify `reconcilePayment`/`voidPayment` take `SELECT ... FOR UPDATE` row lock
      (`lockPayment`) BEFORE read-check-write.
- [ ] Verify location access asserted for payments linked to invoice/PO/expense.
- [ ] Verify controller permissions are now `payments.reconcile` / `payments.void`
      (not `payments.create`); confirm keys exist in permission catalog and Manager seed.
- [ ] Verify state guards: VOIDED cannot reconcile or re-void; `isReconciled` payments
      cannot be voided; already-reconciled cannot re-reconcile.
- [ ] Verify invoice/expense balances recompute correctly after void
      (`recomputeInvoice`, expense paid-state recompute) — including refund-aware formula.
- [ ] Verify audit entries written for VOID and RECONCILE with actor + before/after.
- [ ] Verify historical payments are never deleted — status transitions only.
- [ ] Assess: should reconciliation also be blocked for VOIDED-status edge cases or
      non-RECORDED statuses? Check allowed transitions explicitly.
- [ ] Concurrency test: simultaneous void+reconcile on same payment must yield exactly one
      success (row lock) — verify isolation level is adequate (default read-committed +
      FOR UPDATE is sufficient for single-row check-then-write; confirm no phantom reads).

### ITEM 5 — Self-Approval Prevention & Dead Code Cleanup

- [ ] Verify `authorizeSalesReturn` rejects when `ret.createdBy === userId`
      (ForbiddenException) — and that `receiveSalesReturn`/`rejectSalesReturn` behavior is
      as designed (document whether receive-by-creator is acceptable).
- [ ] Verify `createSalesReturn` rejects `authorizeNow: true` — confirm no alternate path
      (e.g., create DRAFT then self-authorize) can bypass: the authorize endpoint blocks
      creator. Confirm frontend does not send `authorizeNow` (check
      `genuine-frontend/lib/api/sales.ts` and pages).
- [ ] Verify `approveStockAdjustment` blocks `createdBy === userId`.
- [ ] Verify `approvePurchaseOrder` blocks `createdBy === userId`.
- [ ] Verify expense self-approval block still intact (`expenses.service.ts` ~line 489).
- [ ] Verify Owner/Admin override policy: confirm whether system roles are exempt anywhere
      (they are NOT exempt in code — same rule applies; assess if acceptable).
- [ ] Verify dead code removal: `PaymentsService.createExpense`, `getExpenseById`,
      `listExpenses`, `approveExpense`, `rejectExpense`, `nextExpenseNumber` deleted; grep
      entire repo (src, test, scripts, frontend) for references — must be zero.
- [ ] Verify live expense flow (`ExpensesService` + `ExpensesController`) unaffected;
      `payExpense` still works via `POST /payments/expenses/:id/pay`.
- [ ] Verify no other callers of removed methods (controllers, modules, specs).
- [ ] Verify `CreateExpenseDto`/`RejectExpenseDto` imports cleaned from payments.service.

---

## C. Evidence requirements

For EVERY checklist item record:

| Field | Content |
|---|---|
| Checklist item | Item # and description |
| Result | PASS / FAIL / PARTIAL / NOT VERIFIED |
| Evidence | File path + function/endpoint + line numbers |
| Test | Test name or exact command executed |
| Observed | Actual behavior seen (not expected) |
| Risk | CRITICAL / HIGH / MEDIUM / LOW |
| Explanation | Why it passed/failed |
| Remediation | What to fix if failed |

---

## D. Regression audit

Verify these workflows still work end-to-end (trace code + run tests where possible):

- [ ] Create draft invoice → issue → stock decremented once → payment recorded → PAID.
- [ ] Invoice update (DRAFT only) with/without items change; discount cap enforcement.
- [ ] Sales return create → authorize (different user) → receive → stock restored at cost.
- [ ] Return settle REFUND → Payment OUTFLOW created → invoice balance normalized.
- [ ] Return settle CREDIT → balance stays negative = customer credit.
- [ ] Invoice cancel (DRAFT and issued-with-no-payments paths).
- [ ] Payment create via both `/sales/invoices/:id/payments` and `/payments/create`.
- [ ] Payment void → invoice/expense state recompute; reconciled payment cannot void.
- [ ] Expense create → submit → approve (different user) → pay.
- [ ] Stock adjustment create → approve (different user) → stock + movements.
- [ ] PO create → approve (different user) → GRN receive.
- [ ] Reports: income statement, cash flow, receivables/payables ageing, financial summary,
      analytics dashboards — no crashes, plausible numbers.
- [ ] Notifications still fire (INVOICE_CREATED, PAYMENT_RECEIVED, SALES_INVOICE_ISSUED).
- [ ] Audit log entries for all new/changed actions (SETTLE_REFUND, SETTLE_CREDIT, VOID,
      RECONCILE, price_override denials via PermissionGuard).
- [ ] Frontend invoice create/edit still submits correctly (unitPrice field unchanged).

## E. Database / migration audit

- [ ] Confirm NO schema migration was required or executed (verify `prisma/schema.prisma`
      unchanged vs baseline and `prisma/migrations/` has no new folders).
- [ ] Confirm refund tracking uses existing polymorphic `Payment.referenceType/referenceId`
      — no new tables/columns.
- [ ] Confirm no data was modified; all changes are code-only.
- [ ] Confirm backward compatibility: existing DRAFT invoices with custom prices will now
      require `sales.price_override` on next item edit — assess impact on in-flight drafts.
- [ ] Confirm existing payments/returns/invoices unaffected (no backfill needed).
- [ ] Confirm `Payment.expense` cascade and other pre-existing schema issues unchanged
      (out of Phase 1 scope — verify not worsened).

## F. Security audit

- [ ] Price override cannot be bypassed via: negative quantity, unit conversion tricks,
      discount fields, update-without-items, alternate endpoints (POS? none exists),
      wholesale price fields.
- [ ] Location checks cannot be bypassed via: direct IDs, query params, nested resources,
      alternate payment paths (`/payments/create` vs `/sales/invoices/:id/payments`).
- [ ] Refund cannot exceed credit owed; cannot be duplicated; cannot be issued by
      unauthorized user; cannot target another business's return (businessId scoping).
- [ ] Void/reconcile race is closed by row lock; permissions segregated.
- [ ] Self-approval cannot be bypassed via authorizeNow, alternate endpoints, or role
      manipulation.
- [ ] New permission keys cannot be self-granted: check role-management endpoints prevent
      privilege escalation (users cannot grant themselves new permissions — verify
      `roles.manage` / user permission assignment rules).
- [ ] Error messages do not leak sensitive data.

## G. Final audit scorecard

| Item | Result | Evidence summary | Residual risk |
|---|---|---|---|
| 1. Price override protection | | | |
| 2. Branch/location security | | | |
| 3. Returns/refunds/credit notes | | | |
| 4. Payment void/reconciliation | | | |
| 5. Self-approval/dead code | | | |

**Overall verdict:** READY FOR PHASE 2 / NEEDS REMEDIATION (with itemized blockers).
