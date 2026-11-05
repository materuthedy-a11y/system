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
- [x] **22.0.21** Added a visible “Back to customers” link on the new-customer form and create-access-denied state after UI review found no return path.

## Latest runtime finding — 4 Nov 2026

- The database already contains useful records (2 businesses, 3 users, 5 locations, 5 customers, 7 products, 30 invoices, 7 returns and 3 payments); no seed or extra data was needed to fix the empty dashboard.
- Before applying the Phase 22 migration, invoices and the executive dashboard returned HTTP 500 because the database did not yet have `Customer.status` (`P2022`).
- Applied `20261104100000_phase22_customer_status_activity`. Prisma reports the schema is up to date, invoice queries work, and clicking the dashboard Retry now renders the existing financial figures, trend charts, inventory alerts and recent activity.
- Applied `20261104110000_customer_photos`; Prisma schema validates and the updated Prisma Client generates. The customer-photo bytes use WebP validation and a 128 KB compressed limit; photo data is excluded from customer list/detail JSON, which exposes only a photo ID for the protected image request.
- Browser review shows the customer directory loading four existing customer rows and the New customer form exposing the photo picker. Actual image selection/save/reload is still pending a user-provided customer photo; no customer record was created during this review.
- Added temporary PH22 permission accounts and an empty-customer test business for UI coverage; existing customer records were not changed. Remove these fixtures after the permission and empty-state checks are complete.

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
- [x] **22.2.14a GREEN** As Admin User, the New customer action opened the form and the `jumadoja` customer detail opened successfully (2026-11-04).
- [x] **22.2.14b GREEN** The temporary role without `customers.view` received HTTP 403 for the customer list API and saw Customers disabled as “Soon” in the sidebar (2026-11-04; see 22.1.5).
- [x] **22.2.14c GREEN** Temporary `PH22 Customer View Only` role (only `customers.view`, no `customers.create`) signed in and received “Create access required / Your account is not allowed to create customers.” on the direct create route (2026-11-04).
- [x] **22.2.15 GREEN** Temporarily stopped the local API: Customers left loading, showed “Could not connect to the server. Check your connection and try again.” and a Retry button; after restarting the API, Retry restored all five rows (2026-11-04).
- [x] **22.2.16 GREEN** In the temporary empty-customer test business, the directory showed `0 total`, “No customers yet.” and the create-customer guidance (2026-11-04).

### 22.3 — Create customer (UI + API + DB)

- [x] **22.3.1a GREEN** Submitting the blank create form focused a required field and blocked creation (2026-11-04).
- [x] **22.3.1b GREEN** Submitting a malformed email kept the email field focused, blocked submission, and showed the inline message “Enter a valid email address, for example jina@kampuni.com.” (2026-11-04).
- [x] **22.3.1c GREEN** Invalid Tanzanian phone `+255650` was rejected without creating a customer; the inline phone error appeared and focus returned to the phone field (2026-11-04).
- [x] **22.3.1d GREEN** Created `PH22 Valid Customer` with a valid `+255` phone; detail opened and showed ACTIVE status, COD terms, and zero balances (2026-11-04).
- [x] **22.3.2 GREEN** Saved and verified optional second phone, Tax ID, notes, NET-30 terms, and TZS 500,000 credit limit on `PH22 Optional Fields Customer`; editing and saving succeeded after removing create-only fields from the update payload, and notes display on the customer detail page (2026-11-04).
- [x] **22.3.3 GREEN** Created `PH22 Address Contacts Customer`; full address persisted, both additional contacts appeared, and the first contact was marked Primary (2026-11-04).
- [x] **22.3.4 GREEN** Duplicate customer name was rejected with `Customer name or code already exists`; the backend performs this check before creating any records, so no duplicate or partial row is created (2026-11-04).
- [x] **22.3.5 GREEN** Created customer, both contacts, address and CREATE audit event are written in one Prisma transaction; the UI confirmed the customer/address/contacts persisted, and duplicate retry was rejected before transaction creation (2026-11-04).
- [x] **22.3.6 GREEN** Added a customer photo; user confirmed it remained visible after saving and reloading the customer detail page (2026-11-04).
- [x] **22.3.7a GREEN** Created a SUSPENDED customer and confirmed the status in the customer detail UI (2026-11-04).
- [x] **22.3.7b GREEN** Created a BLACKLISTED customer and confirmed the status in the customer detail UI (2026-11-04).
- [x] **22.3.7c GREEN** Created an ARCHIVED customer and confirmed the status in the customer detail UI (2026-11-04).
- [x] **22.3.8a GREEN** Repeated successful customer creation with the phone selector defaulting to Tanzania (+255) and local `650...` input; saved detail showed the normalized `+255` number (2026-11-04).
- [x] **22.3.8b GREEN** Selected UK (+44) for the secondary phone, saved the customer and confirmed edit retained the selected international code (2026-11-04).
- [x] **22.3.8c GREEN** Created a customer with UK (+44) as the primary phone country code; valid international number persisted as `+447400123456` (2026-11-04).

### 22.4 — Edit customer (UI + API + DB)

- [x] **22.4.1 GREEN** Existing values loaded; updated name, email, terms, credit limit and status, while the UK phone remained intact (2026-11-04).
- [x] **22.4.2a GREEN** Replaced the customer photo and user confirmed the replacement remained visible after save and reload (2026-11-04).
- [x] **22.4.2b GREEN** Removed the customer photo; user confirmed the customer detail showed the placeholder after save and reload (2026-11-04).
- [x] **22.4.3a GREEN** Removed both customer contacts; detail now shows `No additional contacts.` (2026-11-04).
- [x] **22.4.3b GREEN** Changed the customer's street; detail showed `14 Nyerere Road` once with the rest of the address intact (2026-11-04).
- [x] **22.4.4a GREEN** Cleared the full address and customer detail now displays `—` (2026-11-04).
- [x] **22.4.4b GREEN** Submitted a deliberately invalid phone while changing customer fields and adding a contact; after cancelling, original name, phone, status, balance and empty contact list remained unchanged (2026-11-04).
- [x] **22.4.5 GREEN** View-only user was blocked from the direct edit route with “Edit access required / Your account is not allowed to edit customers.” Backend `PATCH /suppliers-customers/customers/:id` is guarded by `@RequirePermission('customers.edit')` (UI verified 2026-11-04; API guard verified in controller).
- [x] **22.4.6a GREEN** SUSPENDED customer `PH22 International Phone Customer Edited` was excluded from the new-invoice customer selector; active PH22 customers remained available (2026-11-04).
- [x] **22.4.6b GREEN** Existing draft `INV-202611-00030` retained its inactive customer visibly in the editor; saving unchanged was rejected with `Active customer not found`, and the draft remained open (2026-11-04).
- [x] **22.4.6c GREEN** Attempting to issue `INV-202611-00030` while its customer was SUSPENDED returned `Customer is inactive or unavailable`; invoice remained DRAFT (2026-11-04).
- [x] **22.4.6d GREEN** Reactivated `PH22 Valid Customer` and issued `INV-202611-00030`; status changed to ISSUED and server confirmed stock update (2026-11-04).

### 22.5 — Customer detail and balances

- [x] **22.5.1a GREEN** Customer detail reflected the saved address/contact changes for `PH22 Address Contacts Customer`; `PH22 International Phone Customer Edited` showed SUSPENDED, and reactivated `PH22 Valid Customer` showed ACTIVE (2026-11-04).
- [x] **22.5.1b GREEN** Logged in as the PH19 tenant-B test user and opened the tenant-A customer URL; UI returned `Customer not found` (2026-11-04).
- [x] **22.5.2a GREEN** For `PH22 Valid Customer`, detail and November statement agreed: opening TZS 0 + sale `INV-202611-00030` TZS 3,540 − payments TZS 0 − returns TZS 0 = closing/outstanding TZS 3,540 (2026-11-04).
- [x] **22.5.2b GREEN** `PH21 Filter Customer Alpha` reconciled from detail and statement: opening TZS 0 + sales TZS 22,184 − payments TZS 5,310 − received returns TZS 8,024 = closing/outstanding TZS 8,850 (2026-11-04).
- [x] **22.5.2c GREEN** `PH22 Opening Balance Check` showed opening/outstanding/closing TZS 100,000 with no period sales, payments or returns; the same opening balance carried into October 2026 and February 2024 statements (2026-11-04).
- [x] **22.5.3 GREEN** Customer return aggregation is constrained by `businessId` and customer/invoice association, and includes only RECEIVED/COMPLETED returns; cross-tenant customer access was denied with `Customer not found` in 22.5.1b (backend scope audit, 2026-11-04).
- [x] **22.5.4a GREEN** Customer with TZS 100,000 outstanding and TZS 120,000 limit showed the expected near-limit state (83.33% utilization) per user confirmation (2026-11-04).
- [x] **22.5.4b GREEN** With TZS 100,000 outstanding and TZS 90,000 limit, customer showed 111.11% utilization and `Credit limit exceeded.` (2026-11-04).

### 22.6 — Customer statement

- [x] **22.6.1 GREEN** November statement reconciled for both `PH21 Filter Customer Alpha` and `PH22 Valid Customer`: opening + sales − payments − returns = closing (2026-11-04).
- [x] **22.6.2a GREEN** PH21 Alpha statement for October 2026 showed opening/sales/payments/returns/closing all TZS 0 and `No account movements in this period.` (2026-11-04).
- [x] **22.6.2b GREEN** Previous-month October 2026 statement for `PH22 Opening Balance Check` carried its TZS 100,000 opening balance through to closing; sales/payments/returns were all TZS 0 (2026-11-04).
- [x] **22.6.2c GREEN** February 2024 statement loaded successfully for the opening-balance fixture: opening/closing TZS 100,000, with sales/payments/returns TZS 0 (2026-11-04).
- [x] **22.6.2d CODE REVIEW GREEN** Statement service uses `dateFrom` inclusive (`gte`) and `dateTo` inclusive by advancing the validated date one day and querying with exclusive `lt`; API range is not exposed in the UI.
- [x] **22.6.3 CODE REVIEW GREEN** Service rejects one-sided ranges, month combined with a range, invalid month format, invalid calendar dates, and reversed ranges. Runtime HTTP validation was not exercised because the UI has no range controls.
- [x] **22.6.4 GREEN** PH21 Alpha statement contained its issued sales, recorded payments, and the three RECEIVED returns; it omitted its rejected return. Backend statement query filters to issued invoice statuses, eligible payment statuses, and RECEIVED/COMPLETED returns scoped to the customer/business (2026-11-04).

### 22.7 — Interactions

- [x] **22.7.1a GREEN** Added a NOTE; activity shows Admin User, timestamp (4 Nov 2026), description, and reference `PH22-INT-001` (2026-11-04).
- [x] **22.7.1b GREEN** Added a CALL; activity shows Admin User, timestamp (4 Nov 2026), description, and reference `PH22-CALL-001` (2026-11-04).
- [x] **22.7.1c GREEN** User confirmed the EMAIL interaction was added successfully (2026-11-04).
- [x] **22.7.1d GREEN** User confirmed the VISIT interaction was added successfully (2026-11-04).
- [x] **22.7.2a GREEN** Blank interaction details were rejected in the UI (user confirmed green, 2026-11-04).
- [x] **22.7.2b GREEN** Pasting 2,001 characters was capped by the Details field at its 2,000-character UI limit (user confirmed green, 2026-11-04).
- [x] **22.7.2c CODE REVIEW GREEN** Interaction form is rendered only with `customers.edit`; POST `/customers/:id/activities` independently requires `customers.edit`, so a read-only user cannot submit an interaction. Runtime read-only login was not exercised because the existing temporary test account lacks `customers.view` (2026-11-04).
- [x] **22.7.3 CODE REVIEW GREEN** Activity reads/writes filter and persist `businessId`; write and audit-log (`CUSTOMER_ACTIVITY`) are in one transaction. Code reviewed; no direct database audit-row query was run (2026-11-04).

### 22.8 — Delete safeguards

- [x] **22.8.1a GREEN** Delete confirmation was cancelled for `PH22 Optional Fields Customer`; user confirmed the customer remained (2026-11-04).
- [x] **22.8.1b GREEN** Confirmed deletion of `PH22 Photo Customer` (no financial history); customer detail then returned `Customer not found` (2026-11-04).
- [x] **22.8.2 GREEN** Delete of PH21 Filter Customer Alpha with sales/payment/return history was rejected with `Cannot delete a customer with sales, payments or returns. Change the customer status instead.` (2026-11-04).
- [x] **22.8.3a CODE REVIEW GREEN** DELETE `/customers/:id` requires `customers.delete`; not runtime-tested with a no-delete user (2026-11-04).
- [x] **22.8.3b CODE REVIEW GREEN** Delete resolves the customer using both `id` and authenticated `businessId`; foreign-business IDs return `Customer not found`. Cross-business HTTP attempt not run (2026-11-04).

### 22.9 — Responsive, theme and accessibility

- [x] **22.9.1 GREEN** Tested Customers directory and New customer form at 360px, 390px, 768px, and 1280px. Document/body widths stayed within viewport; form sections and inputs fit; the directory table scrolls inside its own 920px content wrapper without widening the page. Viewport override reset afterward (2026-11-04).
- [x] **22.9.2 GREEN** Visually reviewed Customers directory in light and dark modes at desktop width: light surfaces retain readable dark text and mint/blue/gold metric cards; dark mode uses charcoal surfaces with legible text and status colors. Restored the original dark mode afterward (2026-11-04).
- [x] **22.9.3a GREEN** User confirmed keyboard-only Tab navigation reaches customer directory filters and pagination with visible focus (2026-11-04).
- [x] **22.9.3b GREEN** User confirmed keyboard Tab reaches customer form fields, Add contact, contact fields and Remove with visible focus (2026-11-04).
- [x] **22.9.3c GREEN** User confirmed keyboard navigation opened the delete confirmation dialog, focused Cancel, and closed it without deleting the customer (2026-11-04).
- [x] **22.9.4a GREEN** User confirmed keyboard opened photo picker and selected valid image previewed without submitting customer form (2026-11-04).
- [x] **22.9.4b GREEN** Selecting the checklist markdown file displayed `Chagua picha ya JPG, PNG au WebP.` (2026-11-04).
- [x] **22.9.4c GREEN** Selecting a 15 MiB + 1 byte image displayed `Picha isiwe kubwa kuliko MB 15.` (2026-11-04).
- [x] **22.9.4d GREEN** At 360px, photo card fit within the viewport (document 352px; card 304px); picker label remained visible and enabled, and image preview remained 94×94px. Restored default viewport (2026-11-04).
- [x] **22.9.5 CODE REVIEW GREEN** Customer form fields use labels; loading/error regions use `status`/`alert`; delete dialog has `alertdialog` semantics and label. Added `aria-busy` to customer save and activity actions, plus announced customer-photo processing status; frontend TypeScript check passed. Screen-reader runtime was not manually exercised (2026-11-04).
- [x] **22.9.6a CODE REVIEW GREEN** Global `prefers-reduced-motion: reduce` disables animations/transitions and smooth scrolling; customer list/detail now wrap long names, phone numbers, descriptions and references, while long email is truncated with its full value available as a title. Frontend TypeScript check passed (2026-11-04).
- [x] **22.9.6b GREEN** User confirmed long customer name/email and interaction reference remain contained in the customer page at mobile width (2026-11-04).
- [x] **22.9.7a UI GREEN** On Customers, user confirmed the shared red empty-state surface with green icon looks clear in light mode for a unique nonexistent search (2026-11-04).
- [x] **22.9.7b UI GREEN** User confirmed the customer empty state remains clear in dark mode (2026-11-04).
- [x] **22.9.7c UI GREEN** Customer page header displays `Operations` and `Customers` without a duplicate `Workspace` breadcrumb (2026-11-04).

### 22.10 — Final clean check

- [x] **22.10.1a CODE REVIEW GREEN** App and global error boundaries provide labelled recovery messages/actions; `not-found.tsx` provides styled 404 copy and a dashboard link. Runtime error-boundary action remains untriggered (2026-11-05).
- [x] **22.10.1b UI GREEN** Opened `/route-isiyopo-22`; user confirmed the styled 404 page appeared (2026-11-05).
- [x] **22.10.1c CODE REVIEW GREEN** Recoverable error boundary exposes `Jaribu tena` calling `reset()` and a Dashboard link. A synthetic runtime crash was not forced (2026-11-05).
- [x] **22.10.2 GREEN** Frontend production build succeeded with `NEXT_DIST_DIR=.next-phase22-build`; lint/type checks and static generation passed with no warnings after fixing the `PhoneInput` effect dependency. The default `.next` build path conflicted with the running dev server, so the verification used an isolated output directory (2026-11-05).
- [x] **22.10.3 GREEN** `prisma generate`, `prisma validate`, `tsc --noEmit`, and `nest build` all succeeded individually with Prisma Client v5.22.0. `pnpm build` wrapper still hits Windows `EPERM` while replacing the already-generated query-engine DLL; do not report the wrapper itself as passing (2026-11-05).
- [ ] **22.10.4** No console errors, failed customer requests, 500 responses or Prisma warnings in logs. Current backend smoke start is blocked by PostgreSQL being unreachable (`P1001 localhost:5432`); Windows denied service query/start, so this item is not green yet (2026-11-05).
- [ ] **22.10.5** Re-run relevant Phase 19–21 sales flows to check for regressions.
- [ ] **22.10.6** Record evidence and only then mark Phase 22 complete.
