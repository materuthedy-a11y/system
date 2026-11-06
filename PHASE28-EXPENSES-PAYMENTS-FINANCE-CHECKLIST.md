# Phase 28 — Expenses, Payments & Finance UI

**Status:** Implementation in progress; browser verification is intentionally pending until Phases 25, 24 and 23 have been completed and tested. No item below is marked GREEN from code inspection alone.

This is one shared Phase 28 checklist for Expense Management and Payments & Finance. Expense records and all source payments must stay connected to sales invoices, purchase orders, and approved expenses. The payment register is a transaction register, not a general ledger. Financial statements and reports remain in Reports & Analytics.

Role and route authorization for these modules is tracked in [Phase 31 — Permissions and authorization](PHASE31-PERMISSIONS-AUTHORIZATION-CHECKLIST.md), including the Settings-versus-Finance boundary and create-only access.

## Audit decisions and scope

- [x] Audit Claude's supplied Phase 28 expense UI against the repository's real API and workflow.
- [x] Keep the useful UI ideas: expense register, summary cards, filters, responsive rows, multi-line expense drafts, categories, supporting receipt link, notes, budget code, approval/rejection trail, and workflow actions.
- [x] Correct the mismatches found in the supplied draft: actual route is `/payments/expenses`; pending status is `PENDING_APPROVAL`; a payment is posted through the linked expense payment workflow; currency comes from the business; and there are no supported bulk-approval, `expenses/stats`, or `expenses/monthly-summary` endpoints.
- [x] Keep payment entry attached to its source document so invoice, purchase-order, or expense balances remain authoritative. Do not add an orphan manual payment form.
- [x] Keep finance reports under Reports & Analytics; provide navigation from the Finance screen to the existing finance reports.
- [x] Use existing charcoal, restrained gold, and green styling, permissions, workspace locations, date formatting, and application toasts.
- [ ] Verify there is no remaining double-entry/general-ledger claim in the product copy. The current backend offers payment records, expense workflows, period controls, and operational financial reports, not a full chart-of-accounts ledger.

## 28.1 Expense register and data discovery

- [x] Add an Expenses route and activate its sidebar entry for users with expense access.
- [x] List expenses from the business-scoped backend with pagination, status, search, category, location and date filters.
- [x] Show approved/paid recognized-expense totals separately from pending, approved-unpaid and paid amounts.
- [x] Use business currency and display location/supplier context; do not assume USD or the selected location is the whole business.
- [x] Provide loading, empty, retry/error, desktop table, and mobile-card states.
- [ ] Confirm all filters compose together correctly on real data and pagination resets after filter changes.
- [ ] Confirm the no-data state guides the user to create an expense only when permitted.

## 28.2 Expense draft and edit

- [x] Add create and edit-draft pages using real expense categories, active locations, suppliers, currency and payment methods.
- [x] Support multiple categorized lines, line descriptions/notes, expense date, reference, supplier, location, attachment HTTPS URL, notes and budget code.
- [x] Show a client total while the server remains the source of truth and validates the line total.
- [x] Default a new expense to the active location when available, while allowing business-wide expenses.
- [x] Keep edits and deletes restricted to draft workflow and server permissions.
- [ ] Test create, reload, edit, and delete using a real draft, including multiple categories and amounts.
- [ ] Test invalid attachment URL, missing category, invalid amount, closed period and cross-business location/category rejection.

## 28.3 Expense approval, rejection, budget and payment workflow

- [x] Add detail page with items, supplier/location/reference, notes, receipt link, status and approval/payment history.
- [x] Add submit, approve, reject-with-required-reason, delete-draft and payment actions gated by the corresponding permissions.
- [x] Preserve backend separation-of-duties rule: the creator cannot approve their own expense.
- [x] Show server budget/period validation errors through inline errors and toasts.
- [x] Support full or partial expense payments; partial payments remain approved with the remaining amount visible.
- [x] Require a transaction reference in the UI and backend when a payment method requires one.
- [x] Create expense payments as linked outflows that appear in the Payments & Finance register.
- [x] Recalculate the expense paid state and payment reference when linked payments are voided.
- [ ] Test draft → submit → approval by another authorized user → partial payment → remaining balance → final payment.
- [ ] Test rejection reason, creator self-approval rejection, required payment reference, budget warning/exceeded behavior and accounting-period lock.
- [ ] Test voiding an unreconciled expense payment and verify its balance/status returns correctly; verify reconciled payments cannot be voided.

## 28.4 Payments & Finance register

- [x] Add `/dashboard/finance` and activate Payments & Finance navigation based on payment/reporting-period access.
- [x] Add a business-wide payment register with search, status, source, direction, payment method, location, date range and pagination.
- [x] Include invoice, purchase order, expense and other payment sources with counterparty, location, reference, amount, status and date.
- [x] Add server-side filters that combine instead of replacing one another and validate date ranges.
- [x] Add business currency/options endpoint so payment-view users do not need business-profile permission to format amounts.
- [x] Explain empty-state paths to invoices, purchase orders and expenses. New payment records remain source-linked.
- [ ] Test filters individually and in combination, all locations vs one location, zero results, paging, and business scoping.
- [ ] Confirm source rows from invoices, purchase orders, and expenses all appear exactly once and open the correct payment detail.

## 28.5 Payment detail, reconciliation and void controls

- [x] Add payment detail route with source document link, counterparty, location, method, date, transaction/bank references, notes and status.
- [x] Add reconciliation action requiring a bank-statement reference.
- [x] Add void action requiring a reason; hide void for reconciled or already voided records and explain the balance impact.
- [x] Keep server-side permission, business-scope, and immutable reconciled-payment rules authoritative.
- [ ] Test payment detail links for invoice, PO, and expense origins.
- [ ] Test reconcile, duplicate reconcile protection, void reason, duplicate void protection, reconciled-payment no-void rule, and linked source balance refresh.

## 28.6 Accounting periods and reporting connections

- [x] Add view/create/lock/close accounting-period controls under the Finance screen using existing backend endpoints.
- [x] Show period date range/status and closing notes; explain that locked/closed periods reject dated transactions.
- [x] Gate period access and actions by existing settings permissions.
- [x] Link financial reports to the existing `/dashboard/reports?tab=finance` destination.
- [ ] Test overlapping-period rejection, valid period creation, lock, close, closed-period transaction rejection, and read-only permission behavior.
- [ ] Reconcile Finance register totals and expense summary with existing dashboard/reports using the same business, dates, statuses and currency.
- [ ] Confirm UI copy distinguishes cash movement, recognized expenses, outstanding receivables/payables, and current inventory snapshot; none are presented as a bank balance or full double-entry ledger.

## 28.7 Permissions, locations, accessibility and resilience

- [x] Expose active location options to payment/expense viewers and creators without broadening access to business-profile settings.
- [x] Gate register, details, creation, edits, deletion, approval, payment, and period controls separately in the UI; backend permission checks remain in place.
- [x] Add responsive expense/payment layouts, keyboard-visible focus styles, labeled forms, inline validation, retry states and success/error toasts.
- [ ] Test a view-only user, expense creator, approver who is not the creator, expense payer, payment manager, and settings-only accounting-period viewer.
- [ ] Test narrow mobile width without horizontal page overflow; verify long IDs/references wrap safely.
- [ ] Confirm concurrent/duplicate submissions return a useful server error and do not create duplicate payment records.
- [ ] After Phases 25, 24 and 23: run the agreed browser checklist, then build/type validation and review all errors before marking Phase 28 GREEN.

## Current implementation record

- [x] Expense API/UI routes, form, register, detail workflow, payment register/detail, finance options, location access, partial expense payment handling and sidebar entries are implemented in the working tree.
- [ ] Browser walkthrough and real backend verification are pending by the agreed phase order.
- [ ] Phase 28 is not GREEN yet.
