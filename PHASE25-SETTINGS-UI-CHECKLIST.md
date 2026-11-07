# Phase 25 — Settings UI testing checklist

Implementation is ready for manual UI verification. Do not mark a task green until the stated result is seen in the browser.

## Before starting

- [ ] Start the backend and frontend; sign in as an account with `settings.view` and `settings.edit`.
- [ ] Open `/dashboard/settings` and confirm settings load without an error banner.
- [ ] Confirm the page is usable at desktop and narrow mobile widths; labels, inputs, dialogs and action buttons remain visible and keyboard focus is clear.

## 25.1 Business profile

- [x] Open **Business profile**; confirm the saved business details are populated. User confirmed saved profile values loaded without an error (5 Nov 2026).
- [x] Change one noncritical field (business description), save, refresh, and confirm the value persisted; success toast observed (5 Nov 2026).
- [x] Upload a supported JPG/PNG/WebP logo, preview it, save, refresh, and confirm it remains visible in the app. User confirmed green (5 Nov 2026).
- [x] Use a working direct HTTPS image URL; confirm preview and persistence after save/refresh. User confirmed green (5 Nov 2026).
- [x] For an unreachable HTTPS image URL, confirm Settings shows a clear error toast. User observed “Business logo could not be loaded. Use a direct HTTPS image URL.” (5 Nov 2026).
- [x] Confirm the inline warning replaces the broken-image icon, and workspace/invoice use fallback branding for an unreachable URL; user confirmed green (5 Nov 2026).
- [x] Restore and save a working logo URL after the invalid-URL fallback check. User confirmed green (5 Nov 2026).
- [x] Remove the saved logo and save; removal succeeds and the app returns to its fallback branding. User confirmed green (5 Nov 2026).
- [x] Cause a profile-save failure and confirm the error appears inline and in a toast. User confirms this was already tested green; checkbox had not been recorded (5 Nov 2026).
- [x] Confirm the saved business logo appears in the workspace/location selector and invoice identity. User confirmed logo is visible (5 Nov 2026).
- [x] Confirm missing or invalid logo falls back cleanly to the workspace icon without a broken image. User confirms this was already tested green; checkbox had not been recorded (5 Nov 2026).
- [x] Check required business identity and contact fields remain intact after saving. User showed the saved trading name, email, phone, address and country intact with logo preview (5 Nov 2026).

## 25.2 General settings and downstream defaults

- [x] Set default location (Main Warehouse) and payment method (Cash); both remained after saving and refreshing (user confirmed, 5 Nov 2026).
- [x] Confirm a new invoice preselects the configured location (Main Warehouse, user confirmed 5 Nov 2026).
- [x] Confirm a new purchase order preselects the configured location (Main Warehouse, user confirmed 5 Nov 2026).
- [x] Confirm a new payment form preselects the configured method (Cash, user confirmed 5 Nov 2026).
- [x] Change invoice prefix to `PH25-INV-`; save and refresh; user confirmed it remained saved (5 Nov 2026).
- [x] Invoice prefix integration: after fixing doubled separators, a saved draft generated `PH25-INV-202611-00001` (user confirmed, 5 Nov 2026).
- [x] Change the purchase-order prefix to `PH25-PO-`; saved a draft and confirmed `PH25-PO-202611-00001` (user confirmed, 5 Nov 2026).
- [x] Change the GRN prefix to `PH25-GRN-`; receive and accept 1 unit for `PH25-PO-202611-00001`; confirmed GRN `PH25-GRN-202611-00001`, status `ACCEPTED`, PO `FULLY RECEIVED`, and UI confirmed stock updated (5 Nov 2026).
- [x] Payment reference prefix: recorded supplier payment for TZS 1,200; Dashboard Recent activity shows generated payment number `PAY-202611-93CE34B0` (6 Nov 2026), confirming the `PAY-` prefix is applied.
- [x] Change the low-stock threshold from `0` to `5`; save, refresh and confirm `5` persisted (user confirmed, 6 Nov 2026).
- [x] Change General settings tax from `18%` to `16%`; invoice and purchase-order forms both loaded `16%` after the integration fix (user confirmed, 6 Nov 2026).
- [x] Currency audit finding recorded: changing `TZS` to `USD` relabeled existing amounts without converting them (e.g. a TZS 3,000 invoice displayed US$3,000). The workspace uses a single base currency; historical and new operational documents remain denominated in that currency.
- [ ] User restored `TZS`; refresh the old invoice and confirm it displays TZS again after the currency-lock implementation and migration.
- [x] Change costing method from `Weighted average` to `FIFO`, save/refresh, then restore `Weighted average`; user confirmed green (6 Nov 2026).
- [x] Change financial year to `July to June`; Dashboard **This year** showed `2026-07-01` to `2026-11-07`, then restore `Calendar year` (user confirmed, 7 Nov 2026).
- [x] Confirm a new invoice uses the General settings default tax rate after saving; user confirmed green after the integration fix (6 Nov 2026).
- [x] Confirm a new purchase order loads the effective default purchase tax rate; user confirmed 16% in percentage mode (6 Nov 2026).
- [x] Confirm existing invoices and purchase orders retain their recorded tax amounts after changing defaults: invoice `PH25-INV-202611-00001` remained TZS 3,540 with TZS 540 tax; PO `PH25-PO-202611-00001` remained TZS 1,200 with TZS 0 tax (user confirmed, 6 Nov 2026).
- [x] Change date format to `MM/DD/YYYY`; user confirmed Dashboard displays `11/01/2026 – 11/07/2026` (7 Nov 2026).
- [x] Restore General settings date format to `DD/MM/YYYY`; user confirmed done (7 Nov 2026).
- [x] Confirm sales invoice date and due date use `DD/MM/YYYY`; invoice `PH25-INV-202611-00001` displays `05/11/2026` for both (user confirmed, 7 Nov 2026).
- [ ] Confirm the selected date format appears consistently on customer, purchase, product, inventory, and support screens.
- [ ] Change business timezone; confirm displayed timestamps and dashboard period boundaries follow that timezone.
- [ ] Change week start to Sunday; confirm Dashboard **This week** starts Sunday, then restore Monday.
- [ ] Set financial year to July or April; select **This year** on the dashboard and confirm its start date follows the configured financial year.
- [ ] Set business language to Kiswahili or English; confirm the dashboard figures guide defaults to the selected language (the rest of the UI is not globally translated yet).

## 25.3 Locations

- [ ] Create a location with a unique name/code, type and address; confirm it appears in the list.
- [ ] Edit the location and confirm the updated values persist.
- [ ] Deactivate and reactivate it; confirm inactive locations are excluded from transaction selectors and active ones are selectable.
- [ ] Try setting an inactive location as the default; the UI/API should reject it clearly.

## 25.4 Payment methods

- [ ] Create and edit a method, including type, code, provider/bank details and reference requirement.
- [ ] Deactivate/reactivate it; confirm it is hidden/shown in payment forms while historical transactions remain readable.
- [ ] Make a method the default and verify new payment forms select it.
- [ ] For a method requiring a reference, submit a payment without one and confirm validation; add a reference and confirm the request succeeds.

## 25.5 Tax rates

- [ ] Create a tax rate for sales, purchases or both; edit its name, code, percentage and applicability.
- [ ] Set it as default and confirm the previous default is unset for the same scope.
- [ ] Deactivate a nondefault rate and reactivate it.
- [ ] Confirm the active default rate reaches new sales/purchase documents and that existing documents are unchanged.
- [ ] Confirm the current default cannot be deactivated until another default is selected.

## 25.6 Expense categories

- [ ] Create and edit an expense category; deactivate/reactivate it.
- [ ] Confirm active categories appear in expense entry and inactive ones cannot be selected for new expenses.
- [ ] Confirm existing expense history still displays its category.

## 25.7 Product categories

- [ ] Create and edit a category; deactivate/reactivate it.
- [ ] Confirm new product forms use active categories and historical products keep their category labels.

## 25.8 Units of measurement

- [ ] Open the **Units** section from `/dashboard/settings`.
- [ ] Open the direct page `/dashboard/settings/units`; confirm it opens the same Units management UI.
- [ ] Add a business unit with name, symbol, optional base unit and conversion factor; refresh and confirm it persists.
- [ ] Edit the unit and deactivate/reactivate it.
- [ ] Confirm system/shared units are visible but cannot be edited/deactivated by this business.
- [ ] Confirm the unit is selectable on product forms and any conversion behavior matches the configured base unit/factor.

## 25.9 Users and roles

Cross-system authorization cleanup and role-by-role verification has its own Phase 31 checklist: [Phase 31 — Permissions and authorization](PHASE31-PERMISSIONS-AUTHORIZATION-CHECKLIST.md). Audit history and its own access rules are tracked separately in [Phase 32 — Audit trail](PHASE32-AUDIT-TRAIL-CHECKLIST.md). The code changes are in place; manual role checks remain pending until their acceptance stages.

- [x] Confirm the Forgot Password flow sends a reset email through the SMTP provider configured for the same business as the account. User confirmed green after correcting the Gmail SMTP username to the account email and saving a valid App Password (6 Nov 2026).
- [ ] Open `/dashboard/settings/users`; confirm the user list, role filter and active/inactive filter load.
- [ ] Create a user with a unique email and role; confirm it appears with no password/hash exposed.
- [ ] Edit user identity, role and active state; confirm sessions are revoked when role/email changes or the user is deactivated.
- [ ] Reset a managed user's password and confirm that user's sessions are revoked.
- [ ] Open `/dashboard/settings/roles`; create, edit and delete a custom role and assign only permissions available to this business.
- [ ] Confirm reserved Owner/Admin names and deleting roles still assigned to users are rejected; confirm a business retains at least one active Owner.
- [ ] Confirm direct APIs reject cross-business role/user IDs and insufficient permissions.

## 25.10 Direct settings routes

- [ ] Open `/dashboard/settings/business`, `/dashboard/settings/general`, `/dashboard/settings/users`, `/dashboard/settings/roles`, `/dashboard/settings/locations`, `/dashboard/settings/product-categories`, `/dashboard/settings/payment-methods`, `/dashboard/settings/expense-categories`, `/dashboard/settings/tax-settings`, and `/dashboard/settings/units` directly; each must select its matching section, not a blank page or wrong tab.

## 25.11 Permissions and failure states

- [ ] Sign in as a view-only user: settings load, editing controls are disabled, and direct mutation attempts return a permission error.
- [ ] Sign in as a user without `settings.view`: settings page shows a clear access error rather than a blank/broken page.
- [ ] Simulate a failed save/network response; confirm the save button shows progress, the error is readable, and retry works without duplicate records.
- [ ] Confirm changing settings in one business/workspace does not leak into another business/workspace.

## 25.12 Cross-module and data-contract audit

- [ ] Verify settings defaults reach every consumer: sales invoice, purchase order/GRN, payment, inventory threshold, dashboard date range and report currency/date formatting.
- [ ] Verify inactive locations, payment methods, tax rates, categories, units and users cannot be chosen for new records; historical records still render their saved values.
- [ ] Verify user deletion/deactivation semantics against the API: existing sales, audit history and ownership must remain valid; the UI must clearly identify whether the action disables access or permanently deletes a user.
- [ ] Verify unit conversion factors are actually applied anywhere a quantity changes. If stock records remain in each product's single base unit, the UI/docs must label that limitation and must not imply cross-unit stock conversion.
- [ ] Audit finding: conversion factors are stored for product-unit choices, but no conversion-factor consumer was found in sales, purchase or inventory stock-write services. This is an implementation/integration gap until verified or explicitly constrained to base-unit entry; do not mark unit conversion green from the Settings screen alone.
- [ ] Verify the Phase 25 migration on a nonempty database preserves existing business values, backfills defaults safely and can be deployed once without duplicate settings.
- [ ] Verify all settings writes create the expected audit record and failed/forbidden writes leave both settings and related records unchanged.

### Online smoke flow — fresh Mizania workspace (5 Nov 2026)

- [x] Create a draft COD invoice for Asha Mushi at Moshi: 2 × Moshi Cola 500ml at TZS 1,800, 18% tax, total TZS 4,248; confirm invoice and due dates both display 05/11/2026 after the calendar-date display fix.
- [x] Issue the invoice; confirm status becomes ISSUED and stock changes from 24 to 22 Bottle at Moshi, with a SALE movement of -2.
- [x] Add Cash payment method when the fresh workspace had no available methods; record TZS 4,248 against the invoice and confirm status PAID, paid total TZS 4,248 and zero balance.
- [x] Verify the recorded Cash transaction appears in the customer account statement with the correct business/location context: Asha Mushi shows SALE TZS 4,248, PAYMENT TZS 4,248, both dated 05/11/2026, and closing balance TZS 0 (user confirmed, 5 Nov 2026).

## 25.13 Business-wide totals vs active location

**Scope contract:** the active location in the workspace switcher is the operational context for creating new records. It is not a hidden global report filter. Executive dashboard and combined business overview reports aggregate the current business across locations. Inventory dashboard summary cards are business-wide; its stock and movement tables start at **All locations** and can be filtered to one location. Detail reports may expose their own explicit location filters. Transaction-specific pages should show the location saved on each record and expose an explicit location filter when the list supports it. Every API must remain scoped to the authenticated business.

- [ ] Switch active location and confirm the dashboard still identifies its figures as business-wide / all locations, while showing the active location separately as the default for new activity.
- [ ] Switch location and confirm no existing invoice, purchase, payment, return, adjustment, transfer or count is moved or silently re-scoped.
- [x] Confirm every Recent activity row shows the source location; where a payment has no invoice, purchase order or expense location, it is explicitly labeled as not recorded rather than assigned to the active location. User confirmed `PH20-SEED-PAY-001` now shows `Main Warehouse` after backend restart and refresh (5 Nov 2026).
- [ ] On Inventory, confirm summary totals include all active locations; the stock balance and recent movement lists default to **All locations**; selecting one location filters both lists and switching back restores the aggregate view.
- [ ] Compare business-wide stock quantity and valuation with the sum of location-level rows, accounting for pagination and the same valuation method; no location is omitted or double-counted.
- [ ] Confirm the combined Reports overview labels itself as business-wide; report detail pages with location filters send the selected location to the API and clear/reset filters correctly.
- [ ] For sales, purchases, returns and payments, create/read records at two locations and verify list/detail filters and saved location labels agree with their source records.
- [ ] Verify financial totals use each transaction's owning location consistently (invoice, return, expense, payment, purchase and supplier return); reject invalid or cross-business location IDs server-side.
- [ ] Audit location access control before enabling staff-specific location visibility: current permissions are business-role permissions and no per-user location assignment model was found. Decide whether staff may see all business locations or require location grants; enforce that policy in APIs, not only the selector UI.
- [ ] Verify an owner/admin can view all business locations and totals; verify any restricted staff account cannot retrieve unauthorized location rows through direct API requests.
- [ ] Confirm the workspace switcher copy says location selection controls new activity, and its confirmation explains that dashboard/business reports remain business-wide.
- [ ] Confirm the active-location choice persists per user and business, resets safely if that location becomes inactive or belongs to another business, and never changes the selected business.

## 25.14 Dashboard data navigation

- [x] Confirm dashboard greeting shows the signed-in user's first name, follows the business language and timezone, changes with the time of day, and leaves business-wide period/location context clear; user confirmed “Good morning, Admin” (7 Nov 2026).
- [x] Confirm dashboard period range uses configured business date format; user confirmed `11/01/2026 – 11/07/2026` (7 Nov 2026).
- [ ] Confirm dashboard period boundaries and timestamps follow configured business timezone.

**Implementation:** KPI cards link to invoice lists, finance/sales/inventory reports or inventory according to the metric and the user's permissions. Recent sales and purchase rows open their source documents; payment rows open their linked invoice or purchase order when permitted, otherwise the finance report; expenses open the finance report because there is no expense detail route. Reorder-watch rows open product detail for users with `products.view`, and Inventory otherwise. Finance and inventory report deep links select their requested report tab.

- [x] Click Total Revenue and confirm it opens sales invoices (or Sales report when the user lacks `sales.view`). User confirmed it opened `/dashboard/sales/invoices` (5 Nov 2026).
- [x] Click Recognized Expenses and confirm the Finance report tab opens; user confirmed `/dashboard/reports?tab=finance` (5 Nov 2026).
- [x] Click Net Profit and confirm the Finance report tab opens; user confirmed `/dashboard/reports?tab=finance` (5 Nov 2026).
- [x] Click Net Profit Margin and confirm the Finance report tab opens; user confirmed the same Finance report destination (5 Nov 2026).
- [x] Click Net Cash Position and confirm the Finance report tab opens; user confirmed same destination as other finance KPIs (5 Nov 2026).
- [x] Click Outstanding Receivables and confirm the Finance report tab opens; user confirmed same destination (5 Nov 2026).
- [x] Click Outstanding Payables and confirm the Finance report tab opens; user confirmed same destination (5 Nov 2026).
- [x] Click Inventory Value and confirm it opens Inventory for authorized users, or Inventory report for users without `inventory.view`. User confirmed `/dashboard/inventory` (5 Nov 2026).
- [x] Click a recent sale; user confirmed it opened invoice detail `/dashboard/sales/invoices/d32b9677-b9e4-4fe0-897c-4e53afb3ce88` (5 Nov 2026).
- [x] Click a recent purchase; confirm its matching purchase-order detail opens and location agrees with the row. Browser is now at purchase order `/dashboard/purchases/orders/3167e5e5-2846-43ac-8562-7bd5bc4b4286`; that order shows Main Warehouse, matching the dashboard activity row (5 Nov 2026).
- [x] Click a recent payment linked to an invoice or purchase order; confirm it opens the linked source document. User clicked `PH20-SEED-PAY-001`; it opened purchase order `PH20-SEED-ORDERED-001` at `/dashboard/purchases/orders/3167e5e5-2846-43ac-8562-7bd5bc4b4286`, showing Main Warehouse (5 Nov 2026). Unlinked payment and expense fallback still need browser verification.
- [x] Click a Reorder watch product; confirm product detail opens for users with `products.view`, otherwise Inventory opens. User clicked the Coca Cola stock alert and confirmed product detail opened at `/dashboard/products/cmw0vhsk2003wrphw2fkhjwem` (5 Nov 2026). Restricted-role fallback still needs verification.
- [x] Confirm a KPI card shows a visible focus ring when reached by keyboard; user confirmed focus appears (5 Nov 2026).
- [x] Keyboard-activate a KPI card with Enter; user confirmed it opened `/dashboard/sales/invoices` (5 Nov 2026).
- [x] Keyboard-activate a recent record with Enter; user confirmed it opened invoice detail `/dashboard/sales/invoices/d32b9677-b9e4-4fe0-897c-4e53afb3ce88` (5 Nov 2026).
- [x] Keyboard-activate a Reorder watch row with Enter; browser is now at product detail `/dashboard/products/cmw0vhsk2003wrphw2fkhjwem` after the stock-alert keyboard step (5 Nov 2026).
- [x] At narrow mobile width, confirm the KPI, recent-record and stock-alert layout stays visible and readable (390 px responsive review; user confirmed mobile appearance is good, 5 Nov 2026).
- [ ] Confirm users only see links to pages they can access; fallback report destinations load without a forbidden or missing-page error.

**Audit findings / implementation notes (5 Nov 2026):** Executive dashboard and combined analytics are currently queried by business ID, so changing the active location does not alter their scope; this is intentional business-wide behavior. Inventory summary is also business-wide, but stock/movement tables were initialized from the active location, which made the page internally inconsistent. The inventory dashboard now defaults both tables to all locations and lets the user filter explicitly. Dashboard/report labels and workspace-switcher copy now make the two scopes visible. Per-location user authorization is not represented by a user-location grant model in the current schema; verify the product policy and enforce it before claiming restricted staff visibility.

**Mobile QA note (5 Nov 2026):** Reviewed the executive dashboard in Chrome's responsive device mode at 390 px wide. The header, KPI cards, charts, spending/cash-flow panels, reorder rows and recent-activity rows remain within the viewport; KPI cards stack into one column and the stock/recent rows retain readable labels and visible arrow affordances. User confirmed the mobile layout looked good. This marks the responsive layout check green; permission-based destinations remain subject to the separate access-fallback check above.

## 25.15 Base currency and exchange rates

**Audit finding:** General settings previously treated `Business.currency` as a display label. Changing TZS to USD left amounts unchanged, making an invoice of TZS 3,000 appear as US$3,000. The current schema stores operational monetary values as amounts in one business base currency; it does not store transaction currency, captured FX rate, or converted base amount per invoice/payment/purchase. Automatically changing existing documents or claiming foreign-currency transactions would therefore be financially unsafe.

**Implemented contract:** each workspace keeps one base currency for all saved prices, balances, inventory valuation and financial records. The base currency is locked once products, stock activity, balances, financial summaries/periods, saved exchange rates or financial transactions exist. Settings now includes an exchange-rate registry and converter: a permitted editor enters the quote and its effective date; the API stores an immutable dated quote and audit event, and converts using the most recent rate effective on the requested date. No built-in market rate is assumed. These quotes are reference/conversion inputs; they do not change the currency of an invoice, receipt or other saved record. Full foreign-currency source documents require transaction-level currency and FX snapshots and remain outside this settings-only feature.

- [x] Apply migration `20261107100000_phase25_currency_rates` to local PostgreSQL; Prisma reported all migrations applied successfully (7 Nov 2026). Migration creates the exchange-rate table without updating monetary records.
- [ ] Refresh `/dashboard/settings/general`; confirm the base currency remains TZS and the old invoice still displays TZS 3,540 (not US$3,540).
- [ ] Attempt to change the existing business base currency to USD; confirm the API rejects it with a clear explanation and saved values remain unchanged. Restore/leave TZS.
- [ ] Open `/dashboard/settings` → **Exchange rates** as a `settings.view` user; confirm they can view the rate list and use the converter, but cannot save a rate.
- [ ] As a `settings.edit` user, save the current market quote for `1 USD = [current quote] TZS` with today’s effective date and a source/note; confirm a success toast, row in history and matching Audit log event. Do not use an invented/stale rate.
- [ ] Save a new quote for a later effective date; confirm the older quote remains visible and is not overwritten. Try saving a duplicate currency/date and confirm a readable conflict error.
- [ ] Convert a known USD amount to TZS and a known TZS amount to USD for the saved rate date; independently verify both arithmetic directions and cent rounding.
- [ ] Request conversion before the first effective date or for an unconfigured currency; confirm a readable “no rate for date” error and no guessed/default rate.
- [ ] Confirm invalid currency codes, zero/negative rates, same-as-base currency, and malformed dates are rejected by the API; confirm data and audit log remain unchanged.
- [ ] Confirm rates and conversion are isolated by business/workspace; a user cannot read or convert another business’s rates.
- [ ] Confirm this phase does not show a foreign-currency invoice/payment as supported: all saved operational records continue to use the single locked base currency until transaction-level FX snapshots are designed and implemented.

**Build status for this addition:** Prisma schema validation and local migration deployment passed. Normal Prisma Client generation hit Windows `EPERM` replacing `query_engine-windows.dll.node`; client generation with `--no-engine`, backend TypeScript and Nest build passed. Frontend TypeScript passes. Frontend production build was attempted with the real API URL configured, but Next.js hit `EPERM` while creating generated route directories under `.next`; UI, role and arithmetic checks remain pending. Do not mark them green until verified.

## 25.16 SMS delivery providers

**Audit finding:** SMS settings only supported Twilio and Africa's Talking. There was no built-in provider connection test or user-facing guide for provider-specific credentials. SMS credentials remain encrypted on the backend and must never be returned to the browser.

**Implemented providers:** Twilio, Africa's Talking, SasiSMS, DARSMS, eHUB SMS and Sakura SMS. The selected provider controls the credential fields and backend request format. SasiSMS needs an API key and optional approved sender ID; DARSMS needs an API key and optional sender ID/default sender; eHUB needs API key, API secret and approved sender UUID; Sakura needs API key and optional approved sender ID. Twilio needs Account SID, Auth Token and verified E.164 From number. Africa's Talking needs username and API key; sender ID is optional. Credentials are encrypted at rest and never returned after saving. **Send test** sends a real, potentially billable SMS and records an audit event.

- [x] Extend the SMS provider config API and UI to support SasiSMS, DARSMS, eHUB SMS and Sakura SMS alongside Twilio and Africa's Talking; backend supports provider-specific API payloads, credential validation and SasiSMS idempotency keys.
- [x] Add a permission-protected real SMS test action and audit records for SMS provider configuration changes and connection-test outcomes. Browser/provider tests remain pending.

- [ ] Open Notifications → Providers as `settings.edit`; confirm all six providers appear and provider-specific credential fields switch correctly.
- [ ] For SasiSMS, create an account and API key, leave sender ID empty for the default sender or enter an approved sender, save, and confirm configured status. SasiSMS currently advertises 10 signup credits; check the live account balance before sending.
- [ ] Send a test SMS to a phone you control; confirm success, provider message ID and delivery/provider log outcome. Confirm credits are debited once.
- [ ] Trigger an SMS notification event; confirm recipient, attempts and readable provider errors show in Delivery log without exposing API credentials or reset tokens.
- [ ] Force provider rejection (invalid API key/sender or no credits); confirm a safe failure, bounded retries and logs without secrets.
- [ ] Confirm retrying a SasiSMS delivery uses the same notification/recipient idempotency key and does not duplicate a message after an ambiguous timeout.
- [ ] Confirm API keys/secrets are not returned by GET config, are encrypted in `SMSConfig.config`, and are required again before replacing provider configuration.
- [ ] Confirm `settings.view` can view provider status but cannot save config or send a test; only `settings.edit` can mutate/test.
- [ ] Verify each provider credential format and sender behavior with a real authorized account before production traffic. Trial credits, sender approval, pricing and delivery are controlled by the provider and can change.
- [ ] Verify provider configuration and delivery are isolated by business; direct API access cannot read or overwrite another workspace's credentials.

**Provider setup docs:** [SasiSMS](https://sms.sasidigital.co.tz/docs) uses a bearer API key and optional approved sender; [DARSMS](https://www.darsms.co.tz/blog/sms-api-integration-guide-tanzania) uses an API key and sender ID; [eHUB SMS](https://sms.ehub.co.tz/api-docs) requires an API key, API secret/HMAC signing and approved sender UUID; [Sakura SMS](https://billing.sakurahost.co.tz/knowledgebase/48/SMS-API-Integration-Guide-Connect-Your-App-to-Sakura-SMS.html) uses a bearer API key and optional sender ID.

## Implementation checks completed

- [x] Frontend TypeScript compilation passes after the final Phase 25 changes.
- [x] Backend NestJS build passes after the final Phase 25 changes.
- [x] Prisma schema validation passes.
- [x] `git diff --check` passes (Git reports only line-ending normalization notices).
- [x] Apply the Phase 25 database migration to local PostgreSQL; migration deployment completed successfully.
- [x] Clarify active-location vs business-wide reporting in dashboard, combined reports and workspace switcher; make inventory table default match business-wide summary. Manual browser verification remains pending.
- [ ] Manual browser verification is still pending; do not call UI tasks green until observed.
