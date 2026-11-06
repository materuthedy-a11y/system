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
- [x] Change currency from `TZS` to `USD`, save/refresh, then restore `TZS`; user confirmed green (6 Nov 2026).
- [x] Change costing method from `Weighted average` to `FIFO`, save/refresh, then restore `Weighted average`; user confirmed green (6 Nov 2026).
- [x] Change financial year to `July to June`; Dashboard **This year** showed `2026-07-01` to `2026-11-07` (user confirmed, 7 Nov 2026). Restore to `Calendar year` after the verification.
- [x] Confirm a new invoice uses the General settings default tax rate after saving; user confirmed green after the integration fix (6 Nov 2026).
- [x] Confirm a new purchase order loads the effective default purchase tax rate; user confirmed 16% in percentage mode (6 Nov 2026).
- [x] Confirm existing invoices and purchase orders retain their recorded tax amounts after changing defaults: invoice `PH25-INV-202611-00001` remained TZS 3,540 with TZS 540 tax; PO `PH25-PO-202611-00001` remained TZS 1,200 with TZS 0 tax (user confirmed, 6 Nov 2026).
- [ ] Change date/time format, timezone, and week-start; confirm dates use the selected format/timezone on sales, customer, purchase, product, inventory, dashboard, and support screens. Confirm the week period uses the selected start day.
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

## Implementation checks completed

- [x] Frontend TypeScript compilation passes after the final Phase 25 changes.
- [x] Backend NestJS build passes after the final Phase 25 changes.
- [x] Prisma schema validation passes.
- [x] `git diff --check` passes (Git reports only line-ending normalization notices).
- [x] Apply the Phase 25 database migration to local PostgreSQL; migration deployment completed successfully.
- [x] Clarify active-location vs business-wide reporting in dashboard, combined reports and workspace switcher; make inventory table default match business-wide summary. Manual browser verification remains pending.
- [ ] Manual browser verification is still pending; do not call UI tasks green until observed.
