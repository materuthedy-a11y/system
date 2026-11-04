# Phase 22 — Customers Module

**Status: IN PROGRESS.** The pasted reference says “complete,” but this workspace had no customer screens and several proposed calls did not exist in the backend. Implementation below follows the actual Genuine API and database. No end-to-end row is green until it is observed in the running app.

## Audit notes

- Existing backend already had customer create/read/update/delete, nested contacts/address, account balances and a monthly/date-range statement.
- The Customers sidebar entry was disabled and the frontend module/routes were absent.
- The reference expected `type`, `code`, `phone2`, activity, suspend/blacklist/archive and report endpoints that did not match the current schema/API. The implemented frontend uses the real names and adds persisted customer status/activity support.
- Existing customer create/update wrote parent and related rows separately; a failed contact/address write could leave partial customer data. These writes are now transactional and create/update audit events.
- Existing return aggregation in customer balances did not constrain the customer’s business in both return branches. That tenant scope is now explicit.
- Existing overdue/outstanding/last-sale filtering/sorting happened after database pagination, causing wrong pages and totals. Those modes now calculate first and paginate the complete result set.
- Sales invoice create, edit and issue now require the customer’s persisted status to be ACTIVE as well as `isActive`.
- The pasted reference advertises top-customer/receivables reports, price lists, categories, and activity types for invoices/payments/returns. Those APIs/models are not part of this customer module’s current contract; do not fake them. They need matching report or ledger phases. Customer activity now records real NOTE/CALL/EMAIL/VISIT entries.
- Claude’s follow-up “critical blockers” list is a generic/stale DISTRO template, not an audit of this repository. Genuine already has the authenticated dashboard layout/sidebar, logout confirmation, profile/settings, middleware using the `genuine-session` cookie, app toaster, theme toggle, mobile navigation, and PWA/offline behavior. Its sample code uses wrong app names, routes, auth cookie, currencies/terms, and state names, so copying it would regress working flows.
- The actual cross-cutting gaps from that list were missing Next.js route/global error fallbacks and a branded 404 page. Genuine styled fallbacks now exist; browser crash/unknown-route behavior remains a checklist verification item.

## Implemented code — awaiting runtime verification

- [x] **22.0.1** Customers API types/client follow current API envelope and exact DTO names.
- [x] **22.0.2** Customers directory is permission gated and supports search, customer type/status, sorting, loading/error/empty states, pagination and retry.
- [x] **22.0.3** Create/edit form supports customer details, credit/payment terms, address and multiple contact records; validation and save feedback included.
- [x] **22.0.4** Customer detail shows account figures, credit health, contacts, statement and interaction history.
- [x] **22.0.5** Customer status supports ACTIVE, SUSPENDED, BLACKLISTED and ARCHIVED; non-active customers are excluded from new/edited/issued invoices.
- [x] **22.0.6** Interaction logging persists NOTE/CALL/EMAIL/VISIT with actor and audit trail.
- [x] **22.0.7** Delete is permission gated, confirmed in UI, and refused by backend when sales, payment or return history exists.
- [x] **22.0.8** Prisma schema plus additive migration add status and activity storage; old inactive records migrate to SUSPENDED.
- [x] **22.0.9** Customers sidebar becomes available only to users with `customers.view`.
- [x] **22.0.10** Visual treatment follows the existing mint/gold/blue light cards, charcoal dark mode, readable text, compact rounded controls and visible focus rings.
- [x] **22.0.11** Customer photo upload, replacement and removal are supported; photos are compressed to WebP, stored in PostgreSQL, business scoped and served only through authenticated API.
- [x] **22.0.12** Added Genuine themed route error, root global error and 404 pages with accessible recovery actions.
- [x] **22.0.13** Applied migrations and confirmed schema is current (18 migrations; Phase 22 and customer-photo migrations applied).
- [ ] **22.0.14** Browser checks below are still pending; do not mark phase complete until they pass.
- [x] **22.0.15** Customer phone inputs now have a country calling-code selector (Tanzania +255 by default), accept local digits, and submit a country-prefixed number; shared by primary, secondary and contact phone fields. Frontend type-check passes; UI behavior still needs verification.
- [x] **22.0.16** Customer search no-results state now uses a friendly, theme-matched empty illustration instead of the generic profile icon.
- [x] **22.0.17** Shared empty-state treatment now covers the active customer, sales, product/catalog, purchase, dashboard, and support screens: soft red surface with a green character icon; actions remain available where relevant.
- [x] **22.0.18** Exposed the already-supported `lastSale` sort option in the Customers UI; runtime ordering and pagination still need verification in 22.2.12.
- [x] **22.0.19** Customers API type and directory now expose `lastSaleDate` so users can see the values used by Last sale sorting.
- [x] **22.0.20** Product name is now Mizania Business Suite with a complete SVG/PNG logo and PWA icon pack; frontend metadata, sidebar, auth, offline/error views, API health/Swagger, and service-worker cache migration are updated. Frontend/backend type-checks and asset-path validation pass; browser visual confirmation remains pending.

## Latest runtime finding — 4 Nov 2026

- The database already contains useful records (2 businesses, 3 users, 5 locations, 5 customers, 7 products, 30 invoices, 7 returns and 3 payments); no seed or extra data was needed to fix the empty dashboard.
- Before applying the Phase 22 migration, invoices and the executive dashboard returned HTTP 500 because the database did not yet have `Customer.status` (`P2022`).
- Applied `20261104100000_phase22_customer_status_activity`. Prisma reports the schema is up to date, invoice queries work, and clicking the dashboard Retry now renders the existing financial figures, trend charts, inventory alerts and recent activity.
- Applied `20261104110000_customer_photos`; Prisma schema validates and the updated Prisma Client generates. The customer-photo bytes use WebP validation and a 128 KB compressed limit; photo data is excluded from customer list/detail JSON, which exposes only a photo ID for the protected image request.
- Browser review shows the customer directory loading four existing customer rows and the New customer form exposing the photo picker. Actual image selection/save/reload is still pending a user-provided customer photo; no customer record was created during this review.

## Current verification blockers

- Frontend TypeScript check passes. A production build was attempted in a separate output folder so it would not touch the running `.next` tree, but Next.js failed while creating a build artifact with Windows `EPERM`. The failure occurred during output creation; the Customers TypeScript check is clean.
- Prisma schema validation passes and the generated client is updated. The running Nest watch compiler reports zero TypeScript errors, and the frontend `tsc --noEmit` check passes. A separate production frontend build remains blocked by Windows `EPERM` while Next creates output files.
- PostgreSQL is running and reachable on port 5432. Both Phase 22 migrations are applied. The dashboard 500 caused by the missing `Customer.status` column is resolved; continue the remaining Phase 22 UI/API checks one at a time.

## Sequential verification — do one task, record evidence, then continue

### 22.1 — Database and API readiness

- [x] **22.1.1** PostgreSQL is reachable at the configured local endpoint.
- [x] **22.1.2** `prisma migrate status` shows migrations applied; new Phase 22 migration is present.
- [x] **22.1.3** Backend starts and health endpoint responds (HTTP 200, status `ok`; 2026-11-04).
- [x] **22.1.4** Authenticated `customers.view` user can GET `/suppliers-customers/customers?page=1&limit=20`; directory returned 5 records, including `jumadoja` (2026-11-04).
- [x] **22.1.5 GREEN** User without `customers.view` is denied by API and has no working Customers sidebar link. Temporary `PH22 Customer Access Check` role returned HTTP 403 (`Missing required permissions: customers.view`); sidebar showed Customers as disabled `Soon`. Dashboard denial was expected because this role has no dashboard permission (2026-11-04).

Temporary test account used: `ph22-no-customer-view@example.test` with role `PH22 Customer Access Check`. Retain only while Phase 22 permission checks need it; remove the temporary user and role after those checks are complete.

### 22.2 — Customer directory (UI)

- [x] **22.2.1 GREEN** Directory loads successfully: 5 rows and pagination `1–5 of 5` (2026-11-04).
- [x] **22.2.2 GREEN** Search by name (`jumadoja`) returned exactly 1 matching row and updated summary/pagination (2026-11-04).
- [x] **22.2.3 GREEN** Search by code (`CUST-00005`) returned exactly 1 matching `jumadoja` row (2026-11-04).
- [x] **22.2.4 GREEN** Search by email (`kilicareplus@gmail.com`) returned exactly 1 matching row for `jumadoja` (2026-11-04).
- [x] **22.2.5 GREEN** Search by phone (`+255 650 745 642`) returned the `jumadoja` record (2026-11-04).
- [x] **22.2.6 GREEN** Nonmatching query `MTEJA-HAKUNA-TEST-99` showed `0 total`, `0 customers`, and “No customers match these filters.” (2026-11-04).
- [x] **22.2.7.1 GREEN** Type = Retail returned the expected 4 records: jumadoja (ACTIVE), PH21 Inactive Customer (SUSPENDED), PH21 Filter Customer Alpha (ACTIVE), and Test Customer (ACTIVE) (2026-11-04).
- [x] **22.2.7.2 GREEN** User confirmed the Wholesale filter returned the expected result (2026-11-04).
- [x] **22.2.7.3 GREEN** Corporate filter returned no customers as expected (2026-11-04).
- [x] **22.2.7.4 GREEN** Distributor filter returned no customers as expected (2026-11-04).
- [x] **22.2.7.5 GREEN** Restoring Type = All types returned all 5 customers (2026-11-04).
- [x] **22.2.8.1 GREEN** Status = Active returned the expected 4 accounts (2026-11-04).
- [x] **22.2.8.2 GREEN** Status = Suspended returned the expected single suspended account (2026-11-04).
- [x] **22.2.8.3 GREEN** Status = Blacklisted returned no customers as expected (2026-11-04).
- [x] **22.2.8.4 GREEN** Status = Archived returned no customers as expected (2026-11-04).
- [x] **22.2.8.5 GREEN** Has outstanding balance returned only PH21 Filter Customer Beta (TZS 3,540) and PH21 Filter Customer Alpha (TZS 8,850); combined TZS 12,390 (2026-11-04).
- [x] **22.2.8.6 GREEN** Clearing the status filter restored all 5 customers (2026-11-04).
- [x] **22.2.9 GREEN** Filtered API results matched the five observed customer records: ACTIVE 4, SUSPENDED 1, BLACKLISTED 0, ARCHIVED 0; overdue returned Alpha + Beta only with TZS 12,390 total (2026-11-04).
- [x] **22.2.10 GREEN** Name descending returned Test Customer, PH21 Inactive Customer, PH21 Filter Customer Beta, PH21 Filter Customer Alpha, then jumadoja (2026-11-04).
- [x] **22.2.11 GREEN** Outstanding balance descending placed the TZS 8,850 and TZS 3,540 accounts first, followed by zero-balance customers (2026-11-04).
- [x] **22.2.12 GREEN** Last sale descending placed Beta and Alpha (both 3 Nov 2026) first; all three customers without sales followed (2026-11-04).
- [x] **22.2.13 GREEN** On the current five-customer dataset, the directory showed `1–5 of 5` and `Page 1 of 1`; Previous and Next were disabled at the single-page boundaries (2026-11-04). Active page-to-page navigation and API comparison remain unverified because the dataset has fewer than the 20-row page size.
- [ ] **22.2.14** Verify create button requires `customers.create` and row details require `customers.view`.
- [ ] **22.2.15** Simulate API timeout/error; confirm loading ends, the error is visible, and Retry recovers.
- [ ] **22.2.16** Verify the empty state when a business has no customers.

### 22.3 — Create customer (UI + API + DB)

- [ ] **22.3.1** Provide valid customer name, type, email and Tanzanian international phone; required/format errors are shown.
- [ ] **22.3.2** Test optional second phone, Tax ID, notes, payment terms and zero/nonzero credit limit.
- [ ] **22.3.3** Test complete address and multiple contacts; first contact is primary.
- [ ] **22.3.4** Try duplicate customer code/name; API returns a useful conflict and creates no partial row.
- [ ] **22.3.5** Verify customer, contacts, address and audit event persist together; retry does not leave orphan records.
- [ ] **22.3.6** Add a photo; verify preview, save and reload from the protected photo endpoint.
- [ ] **22.3.7** Create with each non-active status; status and `isActive` remain consistent.
- [ ] **22.3.8** Verify the phone country selector defaults to Tanzania (+255), accepts a local number such as `650...`, preserves the selected code on edit, and submits a valid international number.

### 22.4 — Edit customer (UI + API + DB)

- [ ] **22.4.1** Existing values load without clearing fields; update name, contact, terms, limit and status.
- [ ] **22.4.2** Replace the photo and verify the latest photo after save; remove it and verify the placeholder.
- [ ] **22.4.3** Removing all contacts clears the old list; changing the address updates one address instead of duplicating it.
- [ ] **22.4.4** Removing the address removes it; failed update rolls back related changes.
- [ ] **22.4.5** Verify `customers.edit` is required by API and UI.
- [ ] **22.4.6** Non-active status prevents new invoices, draft customer changes and issue; reactivation permits valid sales.

### 22.5 — Customer detail and balances

- [ ] **22.5.1** Profile shows accurate contacts/address/status and does not expose another business’ customer.
- [ ] **22.5.2** Sales, payments, accepted returns, opening balance and outstanding balance reconcile against fixture records.
- [ ] **22.5.3** Return totals from another business are excluded.
- [ ] **22.5.4** Credit utilization and near/over-limit message use configured limit and outstanding amount.

### 22.6 — Customer statement

- [ ] **22.6.1** Current month statement reconciles opening + sales − payments − returns = closing balance.
- [ ] **22.6.2** Empty month, previous month, leap day and date-range boundary behave correctly.
- [ ] **22.6.3** Invalid month, one-sided range, invalid date and reversed range return validation errors.
- [ ] **22.6.4** Statement includes only eligible invoices, recorded payments and received/completed returns for this customer/business.

### 22.7 — Interactions

- [ ] **22.7.1** Add NOTE, CALL, EMAIL and VISIT; newest activity shows actor, timestamp and optional reference.
- [ ] **22.7.2** Blank/oversized descriptions are rejected; read-only user cannot add interactions.
- [ ] **22.7.3** Activity is tenant scoped and has an audit log entry.

### 22.8 — Delete safeguards

- [ ] **22.8.1** Cancel keeps the customer unchanged; confirmed delete works for a customer without financial history.
- [ ] **22.8.2** Customer with invoice/payment/return cannot be deleted; response advises changing status instead.
- [ ] **22.8.3** Verify `customers.delete` is required; delete cannot remove another business’ record.

### 22.9 — Responsive, theme and accessibility

- [ ] **22.9.1** At 360px, 390px, tablet and desktop, cards/forms fit; tables scroll without widening the page.
- [ ] **22.9.2** Light mode uses readable mint/gold/blue surfaces; dark mode uses charcoal surfaces and readable contrast.
- [ ] **22.9.3** Keyboard-only navigation reaches filters, forms, dialogs, contact controls and pagination with visible focus.
- [ ] **22.9.4** Photo picker works by keyboard, gives useful unsupported/oversized-image errors and fits mobile.
- [ ] **22.9.5** Dialog/form labels, loading/error announcements and disabled/busy states are accessible.
- [ ] **22.9.6** Reduced-motion preference has no forced animation; long names/emails/references do not break layout.
- [ ] **22.9.7** Visually confirm the shared red/green empty states in light and dark mode, and confirm the header breadcrumb shows one section label without a duplicate “Workspace”.

### 22.10 — Final clean check

- [ ] **22.10.1** Trigger a route error and unknown route; verify styled recovery and 404 pages and their actions.
- [ ] **22.10.2** Frontend production build succeeds.
- [ ] **22.10.3** Backend type-check/build succeeds with generated Prisma client.
- [ ] **22.10.4** No console errors, failed customer requests, 500 responses or Prisma warnings in logs.
- [ ] **22.10.5** Re-run relevant Phase 19–21 sales flows to check for regressions.
- [ ] **22.10.6** Record evidence and only then mark Phase 22 complete.
