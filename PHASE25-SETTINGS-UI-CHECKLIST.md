# Phase 25 — Settings UI testing checklist

Use the task IDs below when reporting results. Keep each unchecked item pending until its stated result is observed in the browser or verified in the implementation.

## 25.0 Start and baseline checks

- [ ] 25.0.1 Start the backend and frontend; sign in as an account with `settings.view` and `settings.edit`.
- [ ] 25.0.2 Open `/dashboard/settings` and confirm settings load without an error banner.
- [ ] 25.0.3 Confirm the page is usable at desktop and narrow mobile widths; labels, inputs, dialogs and action buttons remain visible and keyboard focus is clear.

## 25.1 Business profile

- [x] 25.1.1 Open **Business profile**; confirm the saved business details are populated. User confirmed saved profile values loaded without an error (5 Nov 2026).
- [x] 25.1.2 Change one noncritical field (business description), save, refresh, and confirm the value persisted; success toast observed (5 Nov 2026).
- [x] 25.1.3 Upload a supported JPG/PNG/WebP logo, preview it, save, refresh, and confirm it remains visible in the app. User confirmed green (5 Nov 2026).
- [x] 25.1.4 Use a working direct HTTPS image URL; confirm preview and persistence after save/refresh. User confirmed green (5 Nov 2026).
- [x] 25.1.5 For an unreachable HTTPS image URL, confirm Settings shows a clear error toast. User observed “Business logo could not be loaded. Use a direct HTTPS image URL.” (5 Nov 2026).
- [x] 25.1.6 Confirm the inline warning replaces the broken-image icon, and workspace/invoice use fallback branding for an unreachable URL; user confirmed green (5 Nov 2026).
- [x] 25.1.7 Restore and save a working logo URL after the invalid-URL fallback check. User confirmed green (5 Nov 2026).
- [x] 25.1.8 Remove the saved logo and save; removal succeeds and the app returns to its fallback branding. User confirmed green (5 Nov 2026).
- [x] 25.1.9 Cause a profile-save failure and confirm the error appears inline and in a toast. User confirms this was already tested green; checkbox had not been recorded (5 Nov 2026).
- [x] 25.1.10 Confirm the saved business logo appears in the workspace/location selector and invoice identity. User confirmed logo is visible (5 Nov 2026).
- [x] 25.1.11 Confirm missing or invalid logo falls back cleanly to the workspace icon without a broken image. User confirms this was already tested green; checkbox had not been recorded (5 Nov 2026).
- [x] 25.1.12 Check required business identity and contact fields remain intact after saving. User showed the saved trading name, email, phone, address and country intact with logo preview (5 Nov 2026).

## 25.2 General settings and downstream defaults

- [x] 25.2.1 Set default location (Main Warehouse) and payment method (Cash); both remained after saving and refreshing (user confirmed, 5 Nov 2026).
- [x] 25.2.2 Confirm a new invoice preselects the configured location (Main Warehouse, user confirmed 5 Nov 2026).
- [x] 25.2.3 Confirm a new purchase order preselects the configured location (Main Warehouse, user confirmed 5 Nov 2026).
- [x] 25.2.4 Confirm a new payment form preselects the configured method (Cash, user confirmed 5 Nov 2026).
- [x] 25.2.5 Change invoice prefix to `PH25-INV-`; save and refresh; user confirmed it remained saved (5 Nov 2026).
- [x] 25.2.6 Invoice prefix integration: after fixing doubled separators, a saved draft generated `PH25-INV-202611-00001` (user confirmed, 5 Nov 2026).
- [x] 25.2.7 Change the purchase-order prefix to `PH25-PO-`; saved a draft and confirmed `PH25-PO-202611-00001` (user confirmed, 5 Nov 2026).
- [x] 25.2.8 Change the GRN prefix to `PH25-GRN-`; receive and accept 1 unit for `PH25-PO-202611-00001`; confirmed GRN `PH25-GRN-202611-00001`, status `ACCEPTED`, PO `FULLY RECEIVED`, and UI confirmed stock updated (5 Nov 2026).
- [x] 25.2.9 Payment reference prefix: recorded supplier payment for TZS 1,200; Dashboard Recent activity shows generated payment number `PAY-202611-93CE34B0` (6 Nov 2026), confirming the `PAY-` prefix is applied.
- [x] 25.2.10 Change the low-stock threshold from `0` to `5`; save, refresh and confirm `5` persisted (user confirmed, 6 Nov 2026).
- [x] 25.2.11 Change General settings tax from `18%` to `16%`; invoice and purchase-order forms both loaded `16%` after the integration fix (user confirmed, 6 Nov 2026).
- [x] 25.2.12 Currency audit finding recorded: changing `TZS` to `USD` relabeled existing amounts without converting them (e.g. a TZS 3,000 invoice displayed US$3,000). The workspace uses a single base currency; historical and new operational documents remain denominated in that currency.
- [x] 25.2.13 User restored `TZS`; refreshed old invoice `PH25-INV-202611-00001` and confirmed it displays TZS again after the currency-lock implementation and migration (user confirmed green, 7 Nov 2026).
- [x] 25.2.14 Change costing method from `Weighted average` to `FIFO`, save/refresh, then restore `Weighted average`; user confirmed green (6 Nov 2026).
- [x] 25.2.15 Change financial year to `July to June`; Dashboard **This year** showed `2026-07-01` to `2026-11-07`, then restore `Calendar year` (user confirmed, 7 Nov 2026).
- [x] 25.2.16 Confirm a new invoice uses the General settings default tax rate after saving; user confirmed green after the integration fix (6 Nov 2026).
- [x] 25.2.17 Confirm a new purchase order loads the effective default purchase tax rate; user confirmed 16% in percentage mode (6 Nov 2026).
- [x] 25.2.18 Confirm existing invoices and purchase orders retain their recorded tax amounts after changing defaults: invoice `PH25-INV-202611-00001` remained TZS 3,540 with TZS 540 tax; PO `PH25-PO-202611-00001` remained TZS 1,200 with TZS 0 tax (user confirmed, 6 Nov 2026).
- [x] 25.2.19 Change date format to `MM/DD/YYYY`; user confirmed Dashboard displays `11/01/2026 – 11/07/2026` (7 Nov 2026).
- [x] 25.2.20 Restore General settings date format to `DD/MM/YYYY`; user confirmed done (7 Nov 2026).
- [x] 25.2.21 Confirm sales invoice date and due date use `DD/MM/YYYY`; invoice `PH25-INV-202611-00001` displays `05/11/2026` for both (user confirmed, 7 Nov 2026).
- [x] 25.2.22 Confirm the selected `DD/MM/YYYY` date format appears consistently on customer statement (`03/11/2026`), purchase order/receipt/payment (`05/11/2026`, `06/11/2026`), product movement and created/updated dates (`05/11/2026`, `03/11/2026`), inventory movements (`05/11/2026`, `04/11/2026`, `03/11/2026`), and support conversation/message (`06/11/2026 14:52`). User supplied browser output; confirmed green, 7 Nov 2026.
- [x] 25.2.23 Change business timezone; confirm displayed timestamps and dashboard period boundaries follow that timezone. In `America/New_York`, support showed `06/11/2026 06:52` and Dashboard calculation time showed `07/11/2026 10:46`; after restoring `Africa/Dar_es_Salaam`, support returned to `06/11/2026 14:52` and Dashboard showed `07/11/2026 18:49` with range `01/11/2026 – 07/11/2026`. Corrected Dashboard `asOf` to be the actual calculation timestamp. User confirmed, 7 Nov 2026.
- [x] 25.2.24 Change week start to Sunday; Dashboard **This week** showed `01/11/2026 – 07/11/2026`; after restoring Monday it showed `02/11/2026 – 07/11/2026`. User confirmed, 7 Nov 2026.
- [x] 25.2.25 Confirm Dashboard **This year** follows the configured financial-year start. July-to-June showed `2026-07-01 – 2026-11-07`, then Calendar year was restored (see 25.2.15; user confirmed, 7 Nov 2026).
- [x] 25.2.26 Set business language to Kiswahili and confirm the dashboard greeting, business context and figures guide switch to Kiswahili; restore English and confirm those dashboard sections return to English. User confirmed green (7 Nov 2026). Other application pages are not globally translated yet; system-wide localization is a separate future phase.

## 25.3 Locations

- [x] 25.3.1 Create `PH25 Settings QA Location` (`PH25-SQA-01`, `SHOP`, `Test address only`) and confirm it appears in the Locations list. User confirmed, 7 Nov 2026.
- [x] 25.3.2 Edit `PH25 Settings QA Location` to `PH25 Settings QA Location edited` and address `Test address updated`; after refresh, confirm both persist while code `PH25-SQA-01` and type `SHOP` stay unchanged. User confirmed, 7 Nov 2026.
- [x] 25.3.3 Deactivate and reactivate `PH25 Settings QA Location edited`; confirm the inactive location is excluded from the invoice stock-location selector, then reappears after reactivation. Status update success toast is connected. User confirmed green, 7 Nov 2026.
- [x] 25.3.4 Deactivate the QA location and confirm it is unavailable in General settings' default-location selector; backend guard also rejects inactive or cross-business IDs with a clear validation error. Reactivate the location afterward. User confirmed green, 7 Nov 2026.

## 25.4 Payment methods

- [x] 25.4.1 Create `PH25 QA Bank Transfer` (`PH25-QA-BANK`, `BANK`, reference required), then edit description to `QA test bank updated`; after refresh, confirm the method and edited detail persist (user confirmed, 7 Nov 2026).
- [x] 25.4.2 Deactivate `PH25 QA Bank Transfer` and confirm it is absent from the invoice payment-method selector; confirm historical Cash payment history on `PH25-PO-202611-00001` remains readable; reactivate and confirm the QA method returns to the selector. User confirmed green, 7 Nov 2026.
- [x] 25.4.3 Set `PH25 QA Bank Transfer` as the default and open the customer-payment form for an unpaid invoice; it displayed `PH25 QA Bank Transfer · Default` selected. User confirmed green, 7 Nov 2026.
- [x] 25.4.4 For a method requiring a reference, submit a payment without one and confirm validation; add `PH25-REF-TEST-001` and confirm the request succeeds. Browser blocked the blank reference (`Please fill out this field.`); after submission invoice `INV-202611-00030` showed Paid TZS 1 and balance TZS 3,539. User confirmed by browser output, 8 Nov 2026.

## 25.5 Tax rates

- [x] 25.5.1 Create a nondefault QA tax rate and edit its name, code, percentage and applicability; user confirmed `PH25 QA Test Tax edited · 2.25%`, code `PH25-QA-TAX-2`, scope `BOTH`, active (8 Nov 2026).
- [x] 25.5.2 Set the QA tax rate as default and confirm the previous default is unset for the matching scope; restore the previous default afterward. User confirmed green, 8 Nov 2026.
- [x] 25.5.3 Deactivate and reactivate the nondefault `PH25 QA Test Tax edited` rate; user confirmed green, 8 Nov 2026.
- [x] 25.5.4 With `PH25 QA Test Tax edited` (2.25%, BOTH) marked DEFAULT, new sales invoice and purchase-order forms both auto-filled 2.25%; old invoice `INV-202611-00030` remained at TZS 540 tax and old PO `PH25-PO-202611-00001` remained at TZS 0 tax. User confirmed, 8 Nov 2026.
- [x] 25.5.5 Confirm the current default tax rate cannot be deactivated from the UI; `PH25 QA Test Tax edited` showed no Deactivate control while marked DEFAULT. Backend also rejects deactivating a current default. User confirmed, 8 Nov 2026.

## 25.6 Expense categories

- [x] 25.6.1 Create `PH25 QA Expense`, edit it to `PH25 QA Expense edited` (`PH25_QA_EXP_2`), then deactivate/reactivate it. User confirmed green, 8 Nov 2026.
- [x] 25.6.2 Confirm active categories appear in expense entry and inactive ones cannot be selected for new expenses. User confirmed green, 8 Nov 2026.
- [x] 25.6.3 Confirm existing expense history still displays its category after the category is deactivated. User confirmed green, 8 Nov 2026.

## 25.7 Product categories

- [x] 25.7.1 Create and edit `PH25 QA Product Category` to `PH25 QA Product Category edited`, then deactivate/reactivate it. User confirmed green, 8 Nov 2026.
- [x] 25.7.2 Confirm active category appears in new product form, inactive category is omitted, and saved product retains its category label while that category is inactive. User confirmed green, 8 Nov 2026.

## 25.8 Units of measurement

- [x] 25.8.1 Open the **Units** section from `/dashboard/settings`.
- [x] 25.8.2 Open the direct page `/dashboard/settings/units`; confirm it opens the same Units management UI. User-provided screen showed the Units section at the direct route, 8 Nov 2026.
- [x] 25.8.3 Add `PH25 QA Case` (`ph25case`) with base unit `Bottle` and factor `12`; refresh and confirm it persists as `12 Bottle`. User confirmed, 8 Nov 2026.
- [x] 25.8.4 Edit `PH25 QA Case` to `PH25 QA Case edited`, then deactivate/reactivate it. User confirmed green, 8 Nov 2026.
- [x] 25.8.5 Confirm system/shared units are visible but cannot be edited/deactivated by this business. User confirmed green after the Settings UI hid both controls for the system unit, 8 Nov 2026.
- [x] 25.8.6 Confirm an active business unit is selectable on product forms and its configured base-unit conversion factor is prefilled, saved and shown correctly for the product. `PH25 QA Case edited` persisted as `× 12` with `Bottle` as the product base; user confirmed, 8 Nov 2026.

## 25.9 Users and roles

Cross-system authorization cleanup and role-by-role verification has its own Phase 31 checklist: [Phase 31 — Permissions and authorization](PHASE31-PERMISSIONS-AUTHORIZATION-CHECKLIST.md). Audit history and its own access rules are tracked separately in [Phase 32 — Audit trail](PHASE32-AUDIT-TRAIL-CHECKLIST.md). The code changes are in place; manual role checks remain pending until their acceptance stages.

- [x] 25.9.1 Confirm the Forgot Password flow sends a reset email through the SMTP provider configured for the same business as the account. User confirmed green after correcting the Gmail SMTP username to the account email and saving a valid App Password (6 Nov 2026).
- [x] 25.9.2 Open `/dashboard/settings/users`; confirm the user list, role filter and active/inactive filter load. User confirmed the Manager filter shows one active and one inactive Manager (9 Nov 2026).
- [x] 25.9.3 Create `PH25 QA User` (`ph25.qa.20261109@example.test`) with the Salesperson role; it appeared ACTIVE and no password/hash was exposed. User confirmed green, 9 Nov 2026.
- [x] 25.9.4 Edit the QA user's identity and role, confirm the changed role/email persisted and the old session was revoked; deactivate the user and verify sign-in is rejected with `User account is deactivated.` User confirmed green, 9 Nov 2026.
- [x] 25.9.5 Reactivate the QA user, reset its password from Team access, and confirm the existing session is revoked and the new password permits sign-in. User confirmed green, 9 Nov 2026.
- [x] 25.9.6 Open `/dashboard/settings/roles`; create `PH25 QA Custom Role` with only `products.view`, edit its name/description, confirm it has zero assigned users and one access rule, then delete it. Replaced machine-style permission keys with readable labels/descriptions and green category labels. User confirmed green, 9 Nov 2026.
- [x] 25.9.7 Reserved `Owner` and `Admin` role names were rejected with user-friendly guidance; deletion of `PH25 QA Assigned Role` was rejected while assigned, then succeeded after restoring the QA user's previous role. `Admin User · Owner` remained ACTIVE. User confirmed green, 9 Nov 2026.
- [x] 25.9.8 Salesperson direct access to `/dashboard/settings/roles` was blocked. Added backend regression tests verifying user/role IDs from another business are rejected at service boundaries and a Salesperson without an allowed permission is denied by `PermissionGuard`; all 7 tests passed. Nest compile passed. Full `pnpm build` Prisma generation was blocked by Windows `EPERM` renaming a locked query-engine DLL, not by compilation. User confirmed blocked route, 9 Nov 2026.

## 25.10 Direct settings routes

- [x] 25.10.1 Directly opened `/dashboard/settings/business`, `/dashboard/settings/general`, `/dashboard/settings/users`, `/dashboard/settings/roles`, `/dashboard/settings/locations`, `/dashboard/settings/product-categories`, `/dashboard/settings/payment-methods`, `/dashboard/settings/expense-categories`, `/dashboard/settings/tax-settings`, and `/dashboard/settings/units`; each loaded its matching section. User confirmed green, 9 Nov 2026.

## 25.11 Permissions and failure states

- [x] 25.11.1 Created `PH25 QA Settings Viewer` with only `settings.view` and its QA user. Fixed the expense-category endpoint mismatch that blocked view-only settings data. User confirmed profile data loads with editing controls disabled. Regression test reads actual `PATCH /business/profile` permission metadata and verifies `settings.view` alone is denied and audited; all 8 authorization tests pass (10 Nov 2026).
- [x] 25.11.2 Salesperson without `settings.view` opened a Settings route directly and saw the clear access-required message instead of a blank/broken page (user confirmed, 10 Nov 2026).
- [x] 25.11.3 Offline save displayed a clear connection error and the PWA correctly explained that live business changes are not queued. After reconnect, save succeeded; user removed the temporary description marker and saved the original value back. Offline banner uses warm gold in light mode, charcoal/emerald in dark mode, and photo-glass styling (user confirmed green, 10 Nov 2026).
- [x] 25.11.4 Added and passed a backend regression test with two isolated business settings records: updating `invoicePrefix` for Business A changed only A, while Business B retained its own `B-INV-` value. UI workspace selector was confirmed to list active locations for the single `Genuine Liquor Store` business, so no second-business UI switch was claimed. 9 authorization/business-scope tests passed (10 Nov 2026).

## 25.12 Cross-module and data-contract audit

- [x] 25.12.1 General-settings defaults propagated across modules: base currency `TZS`, default tax `2.25%`, invoice prefix `PH25-INV-`, default location `Main Warehouse · MAIN`, default payment method `PH25 QA Bank Transfer`. New invoice form matched location and tax; PH19 Tonic Water at TZS 1,800 produced tax TZS 40.50 (2.25%) and total TZS 1,840.50. New purchase-order form showed 2.25% tax, TZS currency, `Main Warehouse` as receive location, and PH19 Tonic Water buying price TZS 1,200; tax TZS 27 and total TZS 1,227. Generated invoice `PH25-INV-202611-00002` confirms configured invoice prefix. Sales-payment prefix fix confirmed: payment `PH25-PAY-202611-00001` recorded TZS 1 using default `PH25 QA Bank Transfer` and supplied reference `PH25-QA-PAYMENT-002`; idempotency hash is stored separately. Inventory confirmed global low-stock threshold `5`, negative stock disabled, and 31 low-stock balances; inventory uses the higher of global threshold and product reorder level. Dashboard `This month` showed 01/11/2026–10/11/2026 and money/chart labels in TZS. Report chart date labels were corrected from ISO and visually verified by user after refresh. PO/GRN prefix generation confirmed: `PH25-PO-202611-00001` and `PH25-GRN-202611-00001`.
- [x] 25.12.2 Inactive options excluded from new records and historical value preserved: PH21 Salesperson QA disappeared from new-invoice salesperson choices while inactive, then restored Active. `PH25 QA Inactive Category` was absent from new-product form while inactive, then restored Active. `PH25 QA Inactive Location` (`PH25-QA-LOC-01`, WAREHOUSE) was absent from new PO receive-location choices while inactive, then restored Active. QA inactive payment method was absent from Record payment choices, then restored Active. Invoice tax override is numeric, not a tax picker; while QA `1.11%` rate was inactive, active default `2.25%` continued to populate as expected. `PH25 QA Inactive Unit` (no base, factor 1) was absent from new-product unit choices while inactive. Historical product `PH25 Unit Conversion Check` (`PH25-QA-UNIT-001`) continued displaying saved `PH25 QA Case edited × 12` while that unit was inactive. User confirmed all QA settings restored Active.
- [x] 25.12.3 Managed-user deactivation is a reversible soft-disable, not deletion: the UI warns that active sessions are revoked; sign-in rejects the disabled account; the user remains in the business and can be reactivated. User verified Audit log event for `ph21.salesperson@example.test` with actor Admin User (`materuthedy@gmail.com`), before `isActive: true`, after `false`, then confirmed QA user restored Active. Audit search now includes beforeData/afterData so target email finds the event. Owner guard prevents removing/deactivating the final active Owner.
- [x] 25.12.4 Sales unit conversion verified and QA transaction cleaned up: `PH25-INV-202611-00003` for `PH21 Filter Customer Alpha` used `PH25 QA Case edited ×12`, entered quantity `1`; invoice detail showed 12 base units at TZS 200, subtotal TZS 2,400, tax TZS 54, total TZS 2,454. After issue, Main Warehouse stock decreased from 12 to 0 and value from TSh 1,200 to TSh 0. User cancelled the QA invoice with a test reason; Inventory then confirmed stock restored to 12 and value to TSh 1,200. Server resolves the selected unit factor and stores normalized base-unit quantities/prices.
- [x] 25.12.5 Purchase unit conversion verified end to end: `PH25-PO-202611-00002` used `PH25 QA Case edited ×12`, entered quantity `1` at TZS 1,200; saved PO showed 12 ordered at TZS 100/base unit, subtotal TZS 1,200 and total TZS 1,227. `PH25-GRN-202611-00002` received/accepted 12; Inventory confirmed Main Warehouse on-hand 12 and cost value TSh 1,200. No database migration was needed.
- [ ] 25.12.6 Verify the Phase 25 migration on a nonempty database preserves existing business values, backfills defaults safely and can be deployed once without duplicate settings.
- [x] 25.12.7 Settings write audit and viewer authorization verified: Admin changed low-stock threshold `5 → 6 → 5`; Audit log recorded both `UPDATE SAVE general settings` events with matching before/after values and timestamps. PH25 QA Settings Viewer saw the `settings.edit` read-only notice and could not edit settings; user confirmed green. No Viewer settings write was possible from the UI.

### Online smoke flow — fresh Mizania workspace (5 Nov 2026)

- [x] 25.12.8 Create a draft COD invoice for Asha Mushi at Moshi: 2 × Moshi Cola 500ml at TZS 1,800, 18% tax, total TZS 4,248; confirm invoice and due dates both display 05/11/2026 after the calendar-date display fix.
- [x] 25.12.9 Issue the invoice; confirm status becomes ISSUED and stock changes from 24 to 22 Bottle at Moshi, with a SALE movement of -2.
- [x] 25.12.10 Add Cash payment method when the fresh workspace had no available methods; record TZS 4,248 against the invoice and confirm status PAID, paid total TZS 4,248 and zero balance.
- [x] 25.12.11 Verify the recorded Cash transaction appears in the customer account statement with the correct business/location context: Asha Mushi shows SALE TZS 4,248, PAYMENT TZS 4,248, both dated 05/11/2026, and closing balance TZS 0 (user confirmed, 5 Nov 2026).

## 25.13 Business-wide totals vs active location

**Scope contract:** the active location in the workspace switcher is the operational context for creating new records. It is not a hidden global report filter. Executive dashboard and combined business overview reports aggregate the current business across locations. Inventory dashboard summary cards are business-wide; its stock and movement tables start at **All locations** and can be filtered to one location. Detail reports may expose their own explicit location filters. Transaction-specific pages should show the location saved on each record and expose an explicit location filter when the list supports it. Every API must remain scoped to the authenticated business.

- [x] 25.13.1 Switched active location to `PH19 Test Warehouse`; Dashboard continued to label its figures `Business-wide totals across locations`, identified PH19 Test Warehouse only as the active location for new activity, and showed same business-wide Total Revenue TZS 21,240. Inventory snapshot reflected all locations at TZS 774,200. User supplied the post-switch Dashboard snapshot (12 Nov 2026).
- [x] 25.13.2 With active location switched to `PH19 Test Warehouse`, existing Dashboard activity still showed the QA invoice and PO at `Main Warehouse`, QA/test sales payments at `PH21 Test Branch`, and the expense at `Main Warehouse`. Existing source invoice and PO detail had also retained Main Warehouse. Records were not moved or silently re-scoped (user supplied Dashboard activity evidence, 12 Nov 2026).
- [x] 25.13.3 Confirm every Recent activity row shows the source location; where a payment has no invoice, purchase order or expense location, it is explicitly labeled as not recorded rather than assigned to the active location. User confirmed `PH20-SEED-PAY-001` now shows `Main Warehouse` after backend restart and refresh (5 Nov 2026).
- [x] 25.13.4 On Inventory, confirmed summary totals include all active locations; stock balance and recent movement lists default to **All locations**; selecting one location filters both lists and switching back restores the aggregate view (user confirmed green, 12 Nov 2026).
- [x] 25.13.5 Compared business-wide stock quantity and valuation with the sum of location-level rows across pages; no location was omitted or double-counted (user confirmed green, 12 Nov 2026).
- [x] 25.13.6 Confirmed the Reports inventory summary is a business-wide snapshot (579 units, TZS 774,200, 5 locations with stock); verified the dedicated Stock valuation report location filter and its return to All locations (user confirmed green, 12 Nov 2026).
- [x] 25.13.7 For sales, purchases, returns and payments, create/read records at two locations and verify list/detail filters and saved location labels agree with their source records. Purchases filter verified: Main Warehouse shows its seven purchase orders and PH21 Test Branch shows none (user confirmed green, 13 Nov 2026). Sales invoice filter confirmed green (13 Nov 2026). Added the missing Sales returns location filter; user confirmed all seven return requests appear for PH21 Test Branch (13 Nov 2026). Payment list filters and source detail locations confirmed for PH21 Test Branch and Main Warehouse (user confirmed green, 13 Nov 2026).
- [x] 25.13.8 Verify financial totals use each transaction's owning location consistently (invoice, return, expense, payment, purchase and supplier return); reject invalid or cross-business location IDs server-side. User confirmed Finance report totals remained consistent across the tested active locations (13 Nov 2026); backend location-filter tests reject out-of-business location IDs for sales invoices, purchases, expenses and payments (23 backend tests pass).
- [x] 25.13.9 Location access policy implemented: system Owner/Admin can access all locations in their own business; other staff are scoped to active locations where they are assigned as manager, and staff without an assignment are denied. Enforcement added to location options, Sales/Purchase/Payment/Expense list/detail reads, inventory balance/reorder/adjustment/transfer/count lists and reports, and invoice/purchase/expense/transfer/count/payment/return creation paths. Backend build and tests pass (13 Nov 2026); direct API verification remains in 25.13.10.
- [ ] 25.13.10 Verify an owner/admin can view all business locations and totals; verify any restricted staff account cannot retrieve unauthorized location rows through direct API requests. User confirmed the assigned salesperson sees PH19 Test Warehouse and PH21 Test Branch in the invoice location selector while Owner retains all locations (13 Nov 2026); automated policy tests cover Owner bypass, assigned scope and denial without assignment (23 backend tests pass). A direct request for an unauthorized location record remains to verify.
- [x] 25.13.11 Confirm the workspace switcher copy says location selection controls new activity, and its confirmation explains that dashboard/business reports remain business-wide. User confirmed both the switcher guidance and confirmation copy green (13 Nov 2026).
- [ ] 25.13.12 Confirm the active-location choice persists per user and business, resets safely if that location becomes inactive or belongs to another business, and never changes the selected business. User confirmed active-location persistence and inactive-location fallback green (13 Nov 2026); cross-business behavior was not separately verified.

## 25.14 Dashboard data navigation

- [x] 25.14.1 Confirm dashboard greeting shows the signed-in user's first name, follows the business language and timezone, changes with the time of day, and leaves business-wide period/location context clear; user confirmed “Good morning, Admin” (7 Nov 2026).
- [x] 25.14.2 Confirm dashboard period range uses configured business date format; user confirmed `11/01/2026 – 11/07/2026` (7 Nov 2026).
- [ ] 25.14.3 Confirm dashboard period boundaries and timestamps follow configured business timezone.

**Implementation:** KPI cards link to invoice lists, finance/sales/inventory reports or inventory according to the metric and the user's permissions. Recent sales and purchase rows open their source documents; payment rows open their linked invoice or purchase order when permitted, otherwise the finance report; expenses open the finance report because there is no expense detail route. Reorder-watch rows open product detail for users with `products.view`, and Inventory otherwise. Finance and inventory report deep links select their requested report tab.

- [x] 25.14.4 Click Total Revenue and confirm it opens sales invoices (or Sales report when the user lacks `sales.view`). User confirmed it opened `/dashboard/sales/invoices` (5 Nov 2026).
- [x] 25.14.5 Click Recognized Expenses and confirm the Finance report tab opens; user confirmed `/dashboard/reports?tab=finance` (5 Nov 2026).
- [x] 25.14.6 Click Net Profit and confirm the Finance report tab opens; user confirmed `/dashboard/reports?tab=finance` (5 Nov 2026).
- [x] 25.14.7 Click Net Profit Margin and confirm the Finance report tab opens; user confirmed the same Finance report destination (5 Nov 2026).
- [x] 25.14.8 Click Net Cash Position and confirm the Finance report tab opens; user confirmed same destination as other finance KPIs (5 Nov 2026).
- [x] 25.14.9 Click Outstanding Receivables and confirm the Finance report tab opens; user confirmed same destination (5 Nov 2026).
- [x] 25.14.10 Click Outstanding Payables and confirm the Finance report tab opens; user confirmed same destination (5 Nov 2026).
- [x] 25.14.11 Click Inventory Value and confirm it opens Inventory for authorized users, or Inventory report for users without `inventory.view`. User confirmed `/dashboard/inventory` (5 Nov 2026).
- [x] 25.14.12 Click a recent sale; user confirmed it opened invoice detail `/dashboard/sales/invoices/d32b9677-b9e4-4fe0-897c-4e53afb3ce88` (5 Nov 2026).
- [x] 25.14.13 Click a recent purchase; confirm its matching purchase-order detail opens and location agrees with the row. Browser is now at purchase order `/dashboard/purchases/orders/3167e5e5-2846-43ac-8562-7bd5bc4b4286`; that order shows Main Warehouse, matching the dashboard activity row (5 Nov 2026).
- [x] 25.14.14 Click a recent payment linked to an invoice or purchase order; confirm it opens the linked source document. User clicked `PH20-SEED-PAY-001`; it opened purchase order `PH20-SEED-ORDERED-001` at `/dashboard/purchases/orders/3167e5e5-2846-43ac-8562-7bd5bc4b4286`, showing Main Warehouse (5 Nov 2026). Unlinked payment and expense fallback still need browser verification.
- [x] 25.14.15 Click a Reorder watch product; confirm product detail opens for users with `products.view`, otherwise Inventory opens. User clicked the Coca Cola stock alert and confirmed product detail opened at `/dashboard/products/cmw0vhsk2003wrphw2fkhjwem` (5 Nov 2026). Restricted-role fallback still needs verification.
- [x] 25.14.16 Confirm a KPI card shows a visible focus ring when reached by keyboard; user confirmed focus appears (5 Nov 2026).
- [x] 25.14.17 Keyboard-activate a KPI card with Enter; user confirmed it opened `/dashboard/sales/invoices` (5 Nov 2026).
- [x] 25.14.18 Keyboard-activate a recent record with Enter; user confirmed it opened invoice detail `/dashboard/sales/invoices/d32b9677-b9e4-4fe0-897c-4e53afb3ce88` (5 Nov 2026).
- [x] 25.14.19 Keyboard-activate a Reorder watch row with Enter; browser is now at product detail `/dashboard/products/cmw0vhsk2003wrphw2fkhjwem` after the stock-alert keyboard step (5 Nov 2026).
- [x] 25.14.20 At narrow mobile width, confirm the KPI, recent-record and stock-alert layout stays visible and readable (390 px responsive review; user confirmed mobile appearance is good, 5 Nov 2026).
- [ ] 25.14.21 Confirm users only see links to pages they can access; fallback report destinations load without a forbidden or missing-page error.

**Audit findings / implementation notes (5 Nov 2026):** Executive dashboard and combined analytics are currently queried by business ID, so changing the active location does not alter their scope; this is intentional business-wide behavior. Inventory summary is also business-wide, but stock/movement tables were initialized from the active location, which made the page internally inconsistent. The inventory dashboard now defaults both tables to all locations and lets the user filter explicitly. Dashboard/report labels and workspace-switcher copy now make the two scopes visible. Per-location user authorization is not represented by a user-location grant model in the current schema; verify the product policy and enforce it before claiming restricted staff visibility.

**Mobile QA note (5 Nov 2026):** Reviewed the executive dashboard in Chrome's responsive device mode at 390 px wide. The header, KPI cards, charts, spending/cash-flow panels, reorder rows and recent-activity rows remain within the viewport; KPI cards stack into one column and the stock/recent rows retain readable labels and visible arrow affordances. User confirmed the mobile layout looked good. This marks the responsive layout check green; permission-based destinations remain subject to the separate access-fallback check above.

## 25.15 Base currency and exchange rates

**Audit finding:** General settings previously treated `Business.currency` as a display label. Changing TZS to USD left amounts unchanged, making an invoice of TZS 3,000 appear as US$3,000. The current schema stores operational monetary values as amounts in one business base currency; it does not store transaction currency, captured FX rate, or converted base amount per invoice/payment/purchase. Automatically changing existing documents or claiming foreign-currency transactions would therefore be financially unsafe.

**Implemented contract:** each workspace keeps one base currency for all saved prices, balances, inventory valuation and financial records. The base currency is locked once products, stock activity, balances, financial summaries/periods, saved exchange rates or financial transactions exist. Settings now includes an exchange-rate registry and converter: a permitted editor enters the quote and its effective date; the API stores an immutable dated quote and audit event, and converts using the most recent rate effective on the requested date. No built-in market rate is assumed. These quotes are reference/conversion inputs; they do not change the currency of an invoice, receipt or other saved record. Full foreign-currency source documents require transaction-level currency and FX snapshots and remain outside this settings-only feature.

- [x] 25.15.1 Apply migration `20261107100000_phase25_currency_rates` to local PostgreSQL; Prisma reported all migrations applied successfully (7 Nov 2026). Migration creates the exchange-rate table without updating monetary records.
- [x] 25.15.2 Refresh `/dashboard/settings/general`; confirmed the base currency remains TZS and old invoice `PH25-INV-202611-00001` displays TZS 3,540 (not US$3,540). User confirmed green, 7 Nov 2026; see also 25.2.13.
- [ ] 25.15.3 Attempt to change the existing business base currency to USD; confirm the API rejects it with a clear explanation and saved values remain unchanged. Restore/leave TZS.
- [ ] 25.15.4 Open `/dashboard/settings` → **Exchange rates** as a `settings.view` user; confirm they can view the rate list and use the converter, but cannot save a rate.
- [ ] 25.15.5 As a `settings.edit` user, save the current market quote for `1 USD = [current quote] TZS` with today’s effective date and a source/note; confirm a success toast, row in history and matching Audit log event. Do not use an invented/stale rate.
- [ ] 25.15.6 Save a new quote for a later effective date; confirm the older quote remains visible and is not overwritten. Try saving a duplicate currency/date and confirm a readable conflict error.
- [ ] 25.15.7 Convert a known USD amount to TZS and a known TZS amount to USD for the saved rate date; independently verify both arithmetic directions and cent rounding.
- [ ] 25.15.8 Request conversion before the first effective date or for an unconfigured currency; confirm a readable “no rate for date” error and no guessed/default rate.
- [ ] 25.15.9 Confirm invalid currency codes, zero/negative rates, same-as-base currency, and malformed dates are rejected by the API; confirm data and audit log remain unchanged.
- [ ] 25.15.10 Confirm rates and conversion are isolated by business/workspace; a user cannot read or convert another business’s rates.
- [ ] 25.15.11 Confirm this phase does not show a foreign-currency invoice/payment as supported: all saved operational records continue to use the single locked base currency until transaction-level FX snapshots are designed and implemented.

**Build status for this addition:** Prisma schema validation and local migration deployment passed. Normal Prisma Client generation hit Windows `EPERM` replacing `query_engine-windows.dll.node`; client generation with `--no-engine`, backend TypeScript and Nest build passed. Frontend TypeScript passes. Frontend production build was attempted with the real API URL configured, but Next.js hit `EPERM` while creating generated route directories under `.next`; UI, role and arithmetic checks remain pending. Do not mark them green until verified.

## 25.16 SMS delivery providers

**Audit finding:** SMS settings only supported Twilio and Africa's Talking. There was no built-in provider connection test or user-facing guide for provider-specific credentials. SMS credentials remain encrypted on the backend and must never be returned to the browser.

**Implemented providers:** Twilio, Africa's Talking, SasiSMS, DARSMS, eHUB SMS and Sakura SMS. The selected provider controls the credential fields and backend request format. SasiSMS needs an API key and optional approved sender ID; DARSMS needs an API key and optional sender ID/default sender; eHUB needs API key, API secret and approved sender UUID; Sakura needs API key and optional approved sender ID. Twilio needs Account SID, Auth Token and verified E.164 From number. Africa's Talking needs username and API key; sender ID is optional. Credentials are encrypted at rest and never returned after saving. **Send test** sends a real, potentially billable SMS and records an audit event.

- [x] 25.16.1 Extend the SMS provider config API and UI to support SasiSMS, DARSMS, eHUB SMS and Sakura SMS alongside Twilio and Africa's Talking; backend supports provider-specific API payloads, credential validation and SasiSMS idempotency keys.
- [x] 25.16.2 Add a permission-protected real SMS test action and audit records for SMS provider configuration changes and connection-test outcomes. Browser/provider tests remain pending.

- [ ] 25.16.3 Open Notifications → Providers as `settings.edit`; confirm all six providers appear and provider-specific credential fields switch correctly.
- [ ] 25.16.4 For SasiSMS, create an account and API key, leave sender ID empty for the default sender or enter an approved sender, save, and confirm configured status. SasiSMS currently advertises 10 signup credits; check the live account balance before sending.
- [ ] 25.16.5 Send a test SMS to a phone you control; confirm success, provider message ID and delivery/provider log outcome. Confirm credits are debited once. SasiSMS dashboard showed 6 test messages, all failed and 0 delivered; balance 3 with 7 credits used. Failure detail: `Value filter failed for user [langusolutions] (source_address filter mismatch)`; one Sender ID request is awaiting review. Backend now surfaces this provider detail and tells the user to wait for approval or ask SasiSMS to allow the sender. Do not retry before the sender/filter is approved; delivery remains pending (7 Nov 2026).
- [ ] 25.16.6 Trigger an SMS notification event; confirm recipient, attempts and readable provider errors show in Delivery log without exposing API credentials or reset tokens.
- [ ] 25.16.7 Force provider rejection (invalid API key/sender or no credits); confirm a safe failure, bounded retries and logs without secrets.
- [ ] 25.16.8 Confirm retrying a SasiSMS delivery uses the same notification/recipient idempotency key and does not duplicate a message after an ambiguous timeout.
- [ ] 25.16.9 Confirm API keys/secrets are not returned by GET config, are encrypted in `SMSConfig.config`, and are required again before replacing provider configuration.
- [ ] 25.16.10 Confirm `settings.view` can view provider status but cannot save config or send a test; only `settings.edit` can mutate/test.
- [ ] 25.16.11 Verify each provider credential format and sender behavior with a real authorized account before production traffic. Trial credits, sender approval, pricing and delivery are controlled by the provider and can change.
- [ ] 25.16.12 Verify provider configuration and delivery are isolated by business; direct API access cannot read or overwrite another workspace's credentials.

**Provider setup docs:** [SasiSMS](https://sms.sasidigital.co.tz/docs) uses a bearer API key and optional approved sender; [DARSMS](https://www.darsms.co.tz/blog/sms-api-integration-guide-tanzania) uses an API key and sender ID; [eHUB SMS](https://sms.ehub.co.tz/api-docs) requires an API key, API secret/HMAC signing and approved sender UUID; [Sakura SMS](https://billing.sakurahost.co.tz/knowledgebase/48/SMS-API-Integration-Guide-Connect-Your-App-to-Sakura-SMS.html) uses a bearer API key and optional sender ID.

## 25.17 Implementation checks

- [x] 25.17.1 Frontend TypeScript compilation passes after the final Phase 25 changes.
- [x] 25.17.2 Backend NestJS build passes after the final Phase 25 changes.
- [x] 25.17.3 Prisma schema validation passes.
- [x] 25.17.4 `git diff --check` passes (Git reports only line-ending normalization notices).
- [x] 25.17.5 Apply the Phase 25 database migration to local PostgreSQL; migration deployment completed successfully.
- [x] 25.17.6 Clarify active-location vs business-wide reporting in dashboard, combined reports and workspace switcher; make inventory table default match business-wide summary. Manual browser verification remains pending.
- [ ] 25.17.7 Manual browser verification is still pending; do not call UI tasks green until observed.
